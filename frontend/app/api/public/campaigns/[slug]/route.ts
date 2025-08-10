import { NextResponse } from "next/server";
import { ensureSupabaseConfigured, supabase } from "../../../_lib/server";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    ensureSupabaseConfigured();
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, description, form_schema, share_slug, is_published")
      .eq("share_slug", params.slug)
      .eq("is_published", true)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }
}


