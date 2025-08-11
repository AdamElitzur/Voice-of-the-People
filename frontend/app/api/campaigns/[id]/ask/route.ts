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

    // Get the top 10% of most recent responses from form_responses
    const { count, error: countErr } = await supabase
      .from("form_responses")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", params.id);

    if (countErr) throw countErr;

    const totalResponses = count || 0;
    const top10PercentCount = Math.max(1, Math.ceil(totalResponses * 0.1));

    const { data: topResponses, error: topErr } = await supabase
      .from("form_responses")
      .select("*")
      .eq("campaign_id", params.id)
      .order("created_at", { ascending: false })
      .limit(top10PercentCount);

    if (topErr) throw topErr;

    // Shuffle the responses to get them in random order
    const shuffledResponses = [...(topResponses || [])].sort(
      () => Math.random() - 0.5
    );

    // Format the responses as context text
    const contextText = shuffledResponses
      .map((response: any) => {
        const answers = response.answers || {};
        const answerText = Object.entries(answers)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        const meta = response.respondent_meta || {};
        const metaText = Object.entries(meta)
          .filter(
            ([key, value]) => key !== "user_agent" && key !== "ip" && value
          )
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return `Response ID: ${response.id}\nDate: ${
          response.created_at
        }\nAnswers: ${answerText}${metaText ? `\nMeta: ${metaText}` : ""}`;
      })
      .join("\n---\n");

    const systemPrompt = `You are a helpful AI Assistant that is tasked to answer the following question "USERCHATINPUT". You should answer the question in the shortest possible way in 2-3 sentences. Please respond in JSON. The JSON should contain "text_answer" and "graphic". To show the graphic we need you to give us structured output that we can turn into a graph. We are using Chart.js.`;

    // Prepare the response data to include in the output
    const responseData = shuffledResponses.map((response: any) => ({
      id: response.id,
      created_at: response.created_at,
      answers: response.answers,
      respondent_meta: response.respondent_meta,
    }));
    const messages = [
      {
        role: "system",
        content: systemPrompt.replace("USERCHATINPUT", question),
      },
      {
        role: "user",
        content: `Question: ${question}\n\nData (top ${shuffledResponses.length} responses):\n${contextText}`,
      },
    ] as any;
    const chat = await (openai as any).chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4.1",
      messages,
      temperature: 0.2,
    });
    const answer = chat.choices?.[0]?.message?.content || "";

    // Try to parse the JSON response from GPT
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(answer);
    } catch (e) {
      // If parsing fails, wrap the answer in the expected format
      parsedResponse = {
        text_answer: answer,
        graphic: null,
      };
    }

    return NextResponse.json({
      answer: parsedResponse.text_answer || answer,
      graphic: parsedResponse.graphic || null,
      used: shuffledResponses.length,
      totalResponses,
      responseData: responseData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "ask failed" },
      { status: 500 }
    );
  }
}
