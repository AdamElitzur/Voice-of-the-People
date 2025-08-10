import { NextResponse } from "next/server";
import {
  ensureSupabaseConfigured,
  flattenAnswersForEmbedding,
  supabase,
  upsertResponseEmbedding,
} from "../../../../_lib/server";

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    ensureSupabaseConfigured();
    const body = await req.json().catch(() => ({}));
    const {
      answers = {},
      respondent = null,
      source = null,
      consent = true,
    } = body || {};

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, title, description, is_published")
      .eq("share_slug", params.slug)
      .eq("is_published", true)
      .single();
    if (cErr || !campaign) {
      return NextResponse.json({ error: "campaign not found" }, { status: 404 });
    }

    const respondent_meta = {
      user_agent: null as string | null, // user agent/IP are not directly available in edge/serverless without headers parsing; keep minimal
      ip: null as string | null,
      source,
      respondent,
      consent,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("form_responses")
      .insert({
        campaign_id: campaign.id,
        answers,
        respondent_clerk_id: null,
        respondent_meta,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    const text = `${campaign.title || ""}\n${campaign.description || ""}\n\n${flattenAnswersForEmbedding(answers)}`.trim();
    try {
      await upsertResponseEmbedding({
        campaignId: campaign.id,
        responseId: inserted.id,
        text,
        extraMetadata: { title: campaign.title || null },
      });
    } catch (e: any) {
      console.warn("[pinecone upsert failed for response]", e.message);
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "submit failed" }, { status: 500 });
  }
}


