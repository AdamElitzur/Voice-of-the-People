import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../../../_lib/server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    ensureSupabaseConfigured();
    const awaited =
      "then" in (ctx.params as any)
        ? await (ctx.params as Promise<{ id: string }>)
        : (ctx.params as { id: string });
    const { id } = awaited;
    const { error: campErr } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", id)
      .eq("created_by", userId)
      .single();
    if (campErr) throw campErr;
    // Fetch all responses in batches to handle large datasets
    let allResponses: any[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("form_responses")
        .select("*")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allResponses = allResponses.concat(data);
        from += batchSize;
        hasMore = data.length === batchSize; // Continue if we got a full batch
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json(allResponses);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "list failed" },
      { status: 500 }
    );
  }
}
