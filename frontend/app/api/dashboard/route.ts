import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../_lib/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const campaignIds = (campaigns || []).map((c) => c.id);
    let countsByCampaign: Record<string, number> = {};
    if (campaignIds.length) {
      const { data: respRows, error: respErr } = await supabase
        .from("form_responses")
        .select("campaign_id")
        .in("campaign_id", campaignIds);
      if (respErr) throw respErr;
      for (const row of respRows || []) {
        const key = String((row as any).campaign_id);
        countsByCampaign[key] = (countsByCampaign[key] || 0) + 1;
      }
    }
    const enriched = (campaigns || []).map((c) => ({
      ...c,
      response_count: countsByCampaign[String(c.id)] || 0,
    }));
    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "dashboard failed" }, { status: 500 });
  }
}
