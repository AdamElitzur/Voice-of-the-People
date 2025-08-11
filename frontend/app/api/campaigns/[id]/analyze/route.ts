import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureSupabaseConfigured, supabase } from "../../../_lib/server";

type AnalyzeItem = { id: string; question: string; answer: string };

export async function POST(
    req: Request,
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

        const body = (await req.json().catch(() => ({}))) as {
            analyzerUrl?: string;
            limitResponses?: number;
        };
        const analyzerUrl = body?.analyzerUrl || process.env.ANALYZER_URL || "http://127.0.0.1:8000/analyze";
        const limitResponses = Number.isFinite(Number(body?.limitResponses))
            ? Math.max(1, Math.min(5000, Number(body?.limitResponses)))
            : undefined;

        // Verify campaign ownership
        const { data: campaign, error: campErr } = await supabase
            .from("campaigns")
            .select("id, form_schema")
            .eq("id", id)
            .eq("created_by", userId)
            .single();
        if (campErr || !campaign) throw campErr || new Error("Campaign not found");

        const questions: any[] = (campaign as any)?.form_schema?.questions || [];
        const questionById = new Map<string, any>();
        for (const q of questions) {
            if (q?.id) questionById.set(String(q.id), q);
        }

        // Fetch responses (optionally in batches)
        let allResponses: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const rangeEnd = limitResponses ? Math.min(from + batchSize - 1, limitResponses - 1) : from + batchSize - 1;
            const { data, error } = await supabase
                .from("form_responses")
                .select("id, answers")
                .eq("campaign_id", id)
                .order("created_at", { ascending: false })
                .range(from, rangeEnd);
            if (error) throw error;

            if (data && data.length > 0) {
                allResponses = allResponses.concat(data);
                from += batchSize;
                const reachedLimit = typeof limitResponses === "number" && allResponses.length >= limitResponses;
                hasMore = data.length === batchSize && !reachedLimit;
            } else {
                hasMore = false;
            }
            if (typeof limitResponses === "number" && allResponses.length >= limitResponses) {
                break;
            }
        }

        // Transform responses -> [{ id, question, answer }]
        const items: AnalyzeItem[] = [];
        let idx = 1;
        for (const r of allResponses) {
            const answers = (r as any)?.answers || {};
            for (const [qid, value] of Object.entries(answers)) {
                // Skip sub-fields like contact_info foo:id:name
                if (qid.includes(":")) continue;
                const q = questionById.get(String(qid));

                let answerText = "";
                if (Array.isArray(value)) {
                    answerText = value.map((v) => String(v)).join(", ");
                } else if (typeof value === "object" && value !== null) {
                    try {
                        answerText = JSON.stringify(value);
                    } catch {
                        answerText = String(value);
                    }
                } else if (typeof value === "number" || typeof value === "boolean") {
                    answerText = String(value);
                } else if (typeof value === "string") {
                    answerText = value.trim();
                }

                if (!answerText) continue;

                items.push({
                    id: String(idx++),
                    question: String(q?.title || q?.label || q?.id || qid),
                    answer: answerText,
                });
            }
        }

        // Call external analyzer
        const res = await fetch(analyzerUrl, {
            method: "POST",
            headers: {
                accept: "*/*",
                "content-type": "application/json",
            },
            body: JSON.stringify(items),
        });

        const analyzerText = await res.text();
        const contentType = res.headers.get("content-type") || "";
        const isJson = contentType.includes("application/json");
        const analyzerData = isJson ? JSON.parse(analyzerText || "{}") : analyzerText;

        return NextResponse.json(
            {
                ok: res.ok,
                status: res.status,
                analyzer: analyzerData,
                sentCount: items.length,
            },
            { status: res.ok ? 200 : 502 }
        );
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "analyze proxy failed" },
            { status: 500 }
        );
    }
}


