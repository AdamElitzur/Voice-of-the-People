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
    const { data: responses, error } = await supabase
      .from("form_responses")
      .select("id, created_at")
      .eq("campaign_id", params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const total = responses?.length || 0;
    return NextResponse.json({ total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "metrics failed" }, { status: 500 });
  }
}


