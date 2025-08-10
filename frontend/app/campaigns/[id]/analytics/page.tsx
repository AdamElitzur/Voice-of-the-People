"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ResponseRow = {
  id: string;
  campaign_id: string;
  created_at: string;
  answers: Record<string, unknown>;
  respondent_meta?: any;
};

export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ total: number } | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "responses" | "ask">(
    "overview"
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [mRes, rRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}/metrics`, { cache: "no-store" }),
          fetch(`/api/campaigns/${campaignId}/responses`, {
            cache: "no-store",
          }),
        ]);
        if (!mRes.ok) {
          const data = await mRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load metrics");
        }
        if (!rRes.ok) {
          const data = await rRes.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load responses");
        }
        const m = await mRes.json();
        const r = await rRes.json();
        setMetrics(m);
        setResponses(Array.isArray(r) ? r : []);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (campaignId) load();
  }, [campaignId]);

  const groupedByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of responses) {
      const d = new Date(row.created_at);
      const key = d.toISOString().slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, count]) => ({ date, count }));
  }, [responses]);

  const maxCount = useMemo(
    () => groupedByDay.reduce((m, x) => Math.max(m, x.count), 0) || 1,
    [groupedByDay]
  );

  const onAsk = async () => {
    try {
      setAsking(true);
      setAnswer(null);
      const res = await fetch(`/api/campaigns/${campaignId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || "Ask failed");
      setAnswer(data?.answer || "");
    } catch (e) {
      console.error(e);
      setAnswer((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SignedOut>
          <RedirectToSignIn
            redirectUrl={`/campaigns/${campaignId}/analytics`}
          />
        </SignedOut>
        <SignedIn>
          {loading ? (
            <Card>
              <CardHeader>
                <CardTitle>Loading analytics…</CardTitle>
                <CardDescription>Please wait</CardDescription>
              </CardHeader>
            </Card>
          ) : error ? (
            <Card>
              <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <Button
                  variant={activeTab === "overview" ? "default" : "outline"}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </Button>
                <Button
                  variant={activeTab === "responses" ? "default" : "outline"}
                  onClick={() => setActiveTab("responses")}
                >
                  Responses
                </Button>
                <Button
                  variant={activeTab === "ask" ? "default" : "outline"}
                  onClick={() => setActiveTab("ask")}
                >
                  Ask AI
                </Button>
              </div>

              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Total responses</CardTitle>
                      <CardDescription>All-time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-semibold">
                        {metrics?.total ?? 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Responses per day</CardTitle>
                      <CardDescription>
                        Last {groupedByDay.length} days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {groupedByDay.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No data yet
                        </div>
                      ) : (
                        <div className="flex items-end gap-2 h-40">
                          {groupedByDay.map((b) => (
                            <div
                              key={b.date}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className="w-8 bg-primary/70 rounded"
                                style={{
                                  height: `${Math.max(
                                    8,
                                    (b.count / maxCount) * 100
                                  )}%`,
                                }}
                                title={`${b.date}: ${b.count}`}
                              />
                              <div className="text-[10px] text-muted-foreground">
                                {b.date.slice(5)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === "responses" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Responses</CardTitle>
                    <CardDescription>Most recent first</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {responses.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No responses yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {responses.slice(0, 100).map((r) => (
                          <div key={r.id} className="rounded border p-3">
                            <div className="text-xs text-muted-foreground mb-1">
                              {new Intl.DateTimeFormat("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                                timeZone: "UTC",
                              }).format(new Date(r.created_at))}
                            </div>
                            <pre className="text-xs whitespace-pre-wrap break-words">
                              {JSON.stringify(r.answers, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeTab === "ask" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Ask AI about responses</CardTitle>
                    <CardDescription>
                      Answers are generated from your collected responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="What do people think about..."
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={onAsk}
                        disabled={asking || !question.trim()}
                      >
                        {asking ? "Thinking…" : "Ask"}
                      </Button>
                    </div>
                    {answer !== null && (
                      <div className="rounded border p-3 text-sm whitespace-pre-wrap">
                        {answer}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </SignedIn>
      </main>
    </>
  );
}
