import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

// Keep as Node.js serverless runtime
export const runtime = "nodejs";

// Zod schemas for Chart.js configuration validation
const DatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
  fill: z.boolean().optional(),
});

const ChartConfigSchema = z.object({
  type: z.enum([
    "bar",
    "line",
    "pie",
    "doughnut",
    "radar",
    "polarArea",
    "scatter",
    "bubble",
  ]),
  data: z.object({
    labels: z.array(z.union([z.string(), z.number()])),
    datasets: z.array(DatasetSchema),
  }),
  options: z.record(z.any()).optional(),
});

const ToolPayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  chart: ChartConfigSchema,
});

type ToolPayload = z.infer<typeof ToolPayloadSchema>;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body?.messages ?? []) as ChatMessage[];
    const data = body?.data; // optional dataset provided by the client
    const preferredChartType = body?.chartType as
      | "bar"
      | "line"
      | "pie"
      | "doughnut"
      | "radar"
      | "polarArea"
      | "scatter"
      | "bubble"
      | undefined;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // Tool schema for function calling
    const toolSchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        chart: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: [
                "bar",
                "line",
                "pie",
                "doughnut",
                "radar",
                "polarArea",
                "scatter",
                "bubble",
              ],
            },
            data: {
              type: "object",
              properties: {
                labels: {
                  type: "array",
                  items: { anyOf: [{ type: "string" }, { type: "number" }] },
                },
                datasets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      data: {
                        type: "array",
                        items: { type: "number" },
                      },
                      backgroundColor: {
                        anyOf: [
                          { type: "string" },
                          { type: "array", items: { type: "string" } },
                        ],
                      },
                      borderColor: {
                        anyOf: [
                          { type: "string" },
                          { type: "array", items: { type: "string" } },
                        ],
                      },
                      borderWidth: { type: "number" },
                      fill: { type: "boolean" },
                    },
                    required: ["label", "data"],
                    additionalProperties: true,
                  },
                },
              },
              required: ["labels", "datasets"],
              additionalProperties: true,
            },
            options: { type: "object", additionalProperties: true },
          },
          required: ["type", "data"],
          additionalProperties: true,
        },
      },
      required: ["title", "description", "chart"],
      additionalProperties: false,
    } as const;

    const systemPrompt = `You are a data visualization assistant that converts chat requests and a provided dataset into valid Chart.js configurations. 
- ONLY produce chart configurations that are valid per Chart.js docs. See: https://www.chartjs.org/
- Ensure data.labels length matches the length of each dataset.data array. If they do not match, transform/aggregate the provided data to make them match and explain the method.
- Prefer sensible defaults (responsive: true, maintainAspectRatio: false, legend and title configured when appropriate).
- If a preferred chart type is provided, favor it when suitable.
- Choose readable colors. If many categories, generate an array of colors.
- Return your result via the function tool with a concise title and description.
`;

    const toolDefinition = {
      type: "function" as const,
      function: {
        name: "render_chart",
        description:
          "Return a valid Chart.js configuration built from the conversation and the provided dataset.",
        parameters: toolSchema,
      },
    };

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages,
      {
        role: "user" as const,
        content: `Here is the dataset (JSON). Use this to build the chart.\nPreferred chart type: ${
          preferredChartType ?? "unspecified"
        }\n\nDATA:\n${JSON.stringify(data ?? null, null, 2)}`,
      },
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.3,
      messages: chatMessages,
      tools: [toolDefinition],
      tool_choice: "auto",
    });

    const choice = completion.choices?.[0];
    const finishReason = choice?.finish_reason;
    const message = choice?.message;

    if (!message) {
      return NextResponse.json(
        { error: "No message returned from model" },
        { status: 500 }
      );
    }

    let payload: ToolPayload | null = null;
    if (finishReason === "tool_calls" && message.tool_calls?.length) {
      const toolCall = message.tool_calls[0];
      if (toolCall.function?.name === "render_chart") {
        try {
          const args = JSON.parse(toolCall.function.arguments ?? "{}");
          const validated = ToolPayloadSchema.parse(args);
          payload = validated;
        } catch (err) {
          return NextResponse.json(
            { error: "Invalid tool payload", details: `${err}` },
            { status: 500 }
          );
        }
      }
    }

    if (!payload) {
      // As a fallback, attempt to parse JSON from the assistant content
      try {
        const maybe = JSON.parse(message.content ?? "{}");
        const validated = ToolPayloadSchema.parse(maybe);
        payload = validated;
      } catch {
        return NextResponse.json(
          {
            error:
              "Model did not return a tool call with a chart. Try rephrasing your request.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      assistantText: message.content ?? "",
      ...payload,
    });
  } catch (error) {
    return NextResponse.json({ error: `${error}` }, { status: 500 });
  }
}
