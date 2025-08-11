import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  openai,
  pineconeIndex,
  supabase,
  ensureSupabaseConfigured,
} from "../../../_lib/server";

// Helper function to get question text (matches frontend logic)
function getQuestionText(questionId: string, campaign: any): string {
  // Handle standard questions
  if (questionId === "Q1") return "Approval Rating";
  if (questionId === "Q2") return "Likelihood to Vote";
  if (questionId === "Q3") return "Most Important Issue";
  if (questionId === "Q4") return "Political Leaning";

  // Handle dynamic questions from campaign form_schema
  if (campaign?.form_schema) {
    try {
      // Parse the form_schema JSON if it's a string
      const schema =
        typeof campaign.form_schema === "string"
          ? JSON.parse(campaign.form_schema)
          : campaign.form_schema;

      if (schema?.questions && Array.isArray(schema.questions)) {
        const question = schema.questions.find((q: any) => q.id === questionId);
        if (question) {
          return (
            question.title || question.text || question.label || questionId
          );
        }
      }
    } catch (error) {
      console.error("Error parsing form_schema:", error);
    }
  }

  // Fallback: try the old questions format
  if (campaign?.questions) {
    const question = campaign.questions.find((q: any) => q.id === questionId);
    if (question) return question.text || question.label || questionId;
  }

  return questionId;
}

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
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("*")
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

    // Group all answers by question ID to create question: answer1, answer2 format
    const questionAnswers: Record<string, string[]> = {};

    shuffledResponses.forEach((response: any) => {
      const answers = response.answers || {};
      Object.entries(answers).forEach(([questionId, answer]) => {
        if (!questionAnswers[questionId]) {
          questionAnswers[questionId] = [];
        }
        if (answer !== null && answer !== undefined && answer !== "") {
          questionAnswers[questionId].push(String(answer));
        }
      });
    });

    // Format as "Question Name: answer1, answer2, answer3..."
    const contextText = Object.entries(questionAnswers)
      .map(([questionId, answers]) => {
        const questionText = getQuestionText(questionId, campaign);
        const uniqueAnswers = [...new Set(answers)]; // Remove duplicates
        return `${questionText}: ${uniqueAnswers.join(", ")}`;
      })
      .join("\n");

    const systemPrompt = `You are a helpful AI Assistant that is tasked to answer the following question "USERCHATINPUT". You should answer the question in the shortest possible way in 2-3 sentences. Please respond in JSON. The JSON should contain "text_answer" and "graphic". To show the graphic we need you to give us structured output that we can turn into a graph. We are using Chart.js. Dont return the answers.`;

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
        content: `Question: ${question}\n\nData from top ${
          shuffledResponses.length
        } responses (${Math.round(
          (shuffledResponses.length / (totalResponses || 1)) * 100
        )}% of total):\n${contextText}`,
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
      contextData: contextText, // The formatted question-answer pairs used in the prompt
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "ask failed" },
      { status: 500 }
    );
  }
}
