"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type QuestionType = "short_text" | "multiple_choice" | "contact_info";
type Question =
  | {
      id: string;
      type: "short_text";
      title: string;
      required: boolean;
      placeholder?: string;
    }
  | {
      id: string;
      type: "multiple_choice";
      title: string;
      required: boolean;
      allowMultiple: boolean;
      options: { id: string; label: string }[];
    }
  | {
      id: string;
      type: "contact_info";
      title: string;
      required: boolean;
    };

export default function PublicFormPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/public/campaigns/${slug}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Campaign not found");
        }
        const data = await res.json();
        setTitle(data.title || "");
        setQuestions(data.form_schema?.questions || []);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (slug) load();
  }, [slug]);

  const onChangeAnswer = (qid: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      // client-side validation for required fields
      const missing: string[] = [];
      for (const q of questions) {
        if (!q.required) continue;
        if (q.type === "short_text") {
          const v = (answers as any)[q.id];
          if (!v || typeof v !== "string" || !v.trim()) missing.push(q.title);
        } else if (q.type === "multiple_choice") {
          const v = (answers as any)[q.id];
          if (
            (q.allowMultiple && (!Array.isArray(v) || v.length === 0)) ||
            (!q.allowMultiple && !v)
          ) {
            missing.push(q.title);
          }
        } else if (q.type === "contact_info") {
          const hasAny = Boolean(
            (answers as any)[`${q.id}:name`] ||
              (answers as any)[`${q.id}:email`] ||
              (answers as any)[`${q.id}:phone`]
          );
          if (!hasAny) missing.push(q.title);
        }
      }
      if (missing.length) {
        alert(`Please complete required: ${missing.join(", ")}`);
        setSubmitting(false);
        return;
      }
      const res = await fetch(`/api/public/campaigns/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to submit response");
      }
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {loading ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading…</CardTitle>
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
        ) : submitted ? (
          <Card>
            <CardHeader>
              <CardTitle>Thank you!</CardTitle>
              <CardDescription>
                Your response has been recorded.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">
                {title || "Untitled campaign"}
              </h1>
              <p className="text-sm text-muted-foreground">Public form</p>
            </div>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              {questions.map((q) => (
                <Card key={q.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{q.title}</CardTitle>
                    {q.required && <CardDescription>Required</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    {q.type === "short_text" && (
                      <input
                        value={(answers[q.id] as string) || ""}
                        onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder || "Your answer"}
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    )}
                    {q.type === "multiple_choice" && (
                      <div className="space-y-2">
                        {q.options.map((o) => (
                          <label
                            key={o.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type={q.allowMultiple ? "checkbox" : "radio"}
                              name={q.id}
                              checked={
                                q.allowMultiple
                                  ? Array.isArray(answers[q.id]) &&
                                    (answers[q.id] as string[]).includes(o.id)
                                  : answers[q.id] === o.id
                              }
                              onChange={(e) => {
                                if (q.allowMultiple) {
                                  const current = Array.isArray(answers[q.id])
                                    ? (answers[q.id] as string[])
                                    : [];
                                  onChangeAnswer(
                                    q.id,
                                    e.target.checked
                                      ? [...current, o.id]
                                      : current.filter((x) => x !== o.id)
                                  );
                                } else {
                                  onChangeAnswer(q.id, o.id);
                                }
                              }}
                            />
                            {o.label}
                          </label>
                        ))}
                      </div>
                    )}
                    {q.type === "contact_info" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Name
                          </label>
                          <input
                            value={(answers[`${q.id}:name`] as string) || ""}
                            onChange={(e) =>
                              onChangeAnswer(`${q.id}:name`, e.target.value)
                            }
                            placeholder="Full name"
                            className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={(answers[`${q.id}:email`] as string) || ""}
                            onChange={(e) =>
                              onChangeAnswer(`${q.id}:email`, e.target.value)
                            }
                            placeholder="name@example.com"
                            className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={(answers[`${q.id}:phone`] as string) || ""}
                            onChange={(e) =>
                              onChangeAnswer(`${q.id}:phone`, e.target.value)
                            }
                            placeholder="(555) 555-5555"
                            className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              <div className="pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </form>
          </>
        )}
      </main>
    </>
  );
}
