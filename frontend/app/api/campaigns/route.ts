import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  ensureSupabaseConfigured,
  generateShareSlug,
  supabase,
} from "../_lib/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "list failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const body = await req.json();
    const {
      title,
      description,
      form_schema = {},
      example_inputs = null,
      multiple_choice_options = null,
      is_published = false,
    } = body || {};
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const share_slug = generateShareSlug();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        title,
        description,
        form_schema,
        example_inputs,
        multiple_choice_options,
        is_published,
        share_slug,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "create failed" }, { status: 500 });
  }
}
