/*
  Centralized server-only utilities: Supabase (service role), Pinecone, OpenAI, and helpers.
  These are used by Next.js Route Handlers to avoid duplicating setup.
*/

import { createClient } from "@supabase/supabase-js";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

// Supabase admin client (service role). Server-only envs in Next.js are not exposed to the client.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: any | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

// Pinecone client and index
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "vibrant-fir";
const PINECONE_INDEX_HOST =
  process.env.PINECONE_INDEX_HOST ||
  "https://vibrant-fir-sw32of4.svc.aped-4627-b74a.pinecone.io";

export const pineconeIndex: any | null = PINECONE_API_KEY
  ? new Pinecone({ apiKey: PINECONE_API_KEY }).index(
      PINECONE_INDEX,
      PINECONE_INDEX_HOST
    )
  : null;

// OpenAI client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const openai: any | null = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

export function ensureSupabaseConfigured(): void {
  if (!supabase) {
    throw new Error("Supabase is not configured on the server");
  }
}

export function generateShareSlug(): string {
  const random = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36).slice(-4);
  return `${random}${ts}`;
}

export function flattenAnswersForEmbedding(input: unknown): string {
  if (!input) return "";
  const parts: string[] = [];
  const walk = (value: any, path: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    } else {
      parts.push(`${path}: ${String(value)}`);
    }
  };
  walk(input, "");
  return parts.join("\n");
}

export async function embedTextForResponse(text: string): Promise<number[]> {
  if (!openai) throw new Error("OpenAI not configured");
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return (data as any)[0].embedding as unknown as number[];
}

export async function upsertResponseEmbedding(args: {
  campaignId: string | number;
  responseId: string | number;
  text: string;
  extraMetadata?: Record<string, unknown>;
}): Promise<void> {
  if (!pineconeIndex) return;
  const embedding = await embedTextForResponse(args.text);
  const vector: any = {
    id: `resp:${args.responseId}`,
    values: embedding,
    metadata: {
      campaignId: String(args.campaignId),
      responseId: String(args.responseId),
      text: args.text,
      ...(args.extraMetadata || {}),
    },
  };
  await (pineconeIndex as any).upsert([vector]);
}


