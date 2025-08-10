import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../../../_lib/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const { error: campErr } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", params.id)
      .eq("created_by", userId)
      .single();
    if (campErr) throw campErr;
    const { data, error } = await supabase
      .from("form_responses")
      .select("*")
      .eq("campaign_id", params.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "list failed" }, { status: 500 });
  }
}


