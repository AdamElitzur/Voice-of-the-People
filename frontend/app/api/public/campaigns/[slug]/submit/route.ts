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
      .select("id, title, description, is_published, published, form_schema")
      .eq("share_slug", params.slug)
      .or("is_published.eq.true,published.eq.true")
      .single();
    if (cErr || !campaign) {
      return NextResponse.json(
        { notFound: true, message: "Campaign is not available" },
        { status: 200 }
      );
    }

    // Validate required questions server-side
    const questions = (campaign as any)?.form_schema?.questions || [];
    const missing: string[] = [];
    for (const q of questions) {
      if (!q?.required) continue;
      if (q.type === "short_text") {
        const v = (answers as any)[q.id];
        if (!v || typeof v !== "string" || !v.trim())
          missing.push(q.title || q.id);
      } else if (q.type === "multiple_choice") {
        const v = (answers as any)[q.id];
        if (q.allowMultiple) {
          if (!Array.isArray(v) || v.length === 0)
            missing.push(q.title || q.id);
        } else if (!v) {
          missing.push(q.title || q.id);
        }
      } else if (q.type === "contact_info") {
        const hasAny = Boolean(
          (answers as any)[`${q.id}:name`] ||
            (answers as any)[`${q.id}:email`] ||
            (answers as any)[`${q.id}:phone`]
        );
        if (!hasAny) missing.push(q.title || q.id);
      }
    }
    if (missing.length) {
      return NextResponse.json(
        { ok: false, message: `Missing required: ${missing.join(", ")}` },
        { status: 200 }
      );
    }

    const ua = (req.headers as any).get?.("user-agent") || null;
    const ip = (req.headers as any).get?.("x-forwarded-for") || null;
    const respondent_meta = {
      user_agent: ua,
      ip,
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

    const text = `${campaign.title || ""}\n${
      campaign.description || ""
    }\n\n${flattenAnswersForEmbedding(answers)}`.trim();
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

    return NextResponse.json({ ok: true, data: inserted }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "submit failed" },
      { status: 200 }
    );
  }
}
