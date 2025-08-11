import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  openai,
  pineconeIndex,
  supabase,
  ensureSupabaseConfigured,
} from "../../../_lib/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    if (!openai || !pineconeIndex) {
      return NextResponse.json(
        { error: "Server missing OpenAI or Pinecone configuration" },
        { status: 500 }
      );
    }
    const body = await req.json().catch(() => ({}));
    const { question, topK = 20 } = body || {};
    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }
    const { error: campErr } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", params.id)
      .eq("created_by", userId)
      .single();
    if (campErr) throw campErr;

    const { data: embData } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const qEmbedding = (embData as any)[0].embedding as number[];
    const result = await pineconeIndex.query({
      vector: qEmbedding,
      topK: Math.max(1, Math.min(200, Number(topK) || 20)),
      includeValues: false,
      includeMetadata: true,
      filter: { campaignId: params.id },
    });
    const contexts = (result.matches || []).map(
      (m: any) => m.metadata?.text || m.metadata?.title || ""
    );
    const systemPrompt =
      "You are an analyst. Answer based only on the provided constituent responses. Provide concise, neutral, non-partisan insights.";
    const contextText = contexts.filter(Boolean).slice(0, 50).join("\n---\n");
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Question: ${question}\n\nData:\n${contextText}`,
      },
    ] as any;
    const chat = await (openai as any).chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1",
      messages,
      temperature: 0.2,
    });
    const answer = chat.choices?.[0]?.message?.content || "";
    return NextResponse.json({ answer, used: contexts.length });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "ask failed" },
      { status: 500 }
    );
  }
}
