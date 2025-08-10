import { NextResponse } from "next/server";
import { openai, pineconeIndex } from "../_lib/server";

export async function POST(req: Request) {
  try {
    if (!openai || !pineconeIndex) {
      return NextResponse.json(
        { error: "Server missing OpenAI or Pinecone configuration" },
        { status: 500 }
      );
    }
    const { text, topK } = (await req.json().catch(() => ({}))) as {
      text?: string;
      topK?: number;
    };
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const k = Number.isFinite(Number(topK))
      ? Math.max(1, Math.min(200, Number(topK)))
      : 20;
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const embedding = (data as any)[0].embedding as number[];
    const result = await pineconeIndex.query({
      vector: embedding,
      topK: k,
      includeValues: true,
      includeMetadata: true,
    });
    const points = (result.matches || []).map((m: any) => ({
      id: m.id,
      score: m.score,
      values: m.values,
      metadata: m.metadata || {},
    }));
    return NextResponse.json({ query: { text, embedding }, points, topK: k });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "query failed" }, { status: 500 });
  }
}


