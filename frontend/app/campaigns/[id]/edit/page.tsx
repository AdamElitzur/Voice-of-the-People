"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Trash2, Type, ListChecks, IdCard } from "lucide-react";
// Back-to-dashboard header removed per request; clean imports
import { SiteHeader } from "@/components/site-header";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { useToast } from "@/components/ui/toast";
import { getCampaignById, updateCampaign } from "@/app/actions/campaigns";

type QuestionType = "short_text" | "multiple_choice" | "contact_info";

type BaseQuestion = {
  id: string;
  type: QuestionType;
  title: string;
  required: boolean;
};

type ShortTextQuestion = BaseQuestion & {
  type: "short_text";
  placeholder?: string;
};

type MultipleChoiceQuestion = BaseQuestion & {
  type: "multiple_choice";
  options: { id: string; label: string }[];
  allowMultiple: boolean;
};

type ContactInfoQuestion = BaseQuestion & { type: "contact_info" };
type Question =
  | ShortTextQuestion
  | MultipleChoiceQuestion
  | ContactInfoQuestion;

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function EditCampaignPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [title, setTitle] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [published, setPublished] = useState<boolean>(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const { push } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCampaignById(campaignId);
        setTitle(data.title || "");
        setQuestions(data.form_schema?.questions || []);
        setPublished(
          Boolean((data as any).is_published ?? (data as any).published)
        );
        setShareSlug(data.share_slug || null);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    if (campaignId) load();
  }, [campaignId]);

  const addShortText = () => {
    const newQuestion: ShortTextQuestion = {
      id: generateId("q"),
      type: "short_text",
      title: "Short text question",
      required: false,
      placeholder: "Your answer...",
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const addMultipleChoice = () => {
    const newQuestion: MultipleChoiceQuestion = {
      id: generateId("q"),
      type: "multiple_choice",
      title: "Multiple choice question",
      required: false,
      options: [
        { id: generateId("opt"), label: "Option 1" },
        { id: generateId("opt"), label: "Option 2" },
      ],
      allowMultiple: false,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const addContactInfo = () => {
    const newQuestion: ContactInfoQuestion = {
      id: generateId("q"),
      type: "contact_info",
      title: "Your contact information",
      required: false,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const moveQuestion = (sourceId: string, targetId: string) => {
    setQuestions((prev) => {
      const sourceIndex = prev.findIndex((q) => q.id === sourceId);
      const targetIndex = prev.findIndex((q) => q.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(sourceIndex, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const updateQuestionTitle = (id: string, newTitle: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, title: newTitle } : q))
    );
  };

  const toggleRequired = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, required: !q.required } : q))
    );
  };

  const addOption = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? {
              ...q,
              options: [
                ...q.options,
                {
                  id: generateId("opt"),
                  label: `Option ${q.options.length + 1}`,
                },
              ],
            }
          : q
      )
    );
  };

  const updateOption = (id: string, optionId: string, label: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? {
              ...q,
              options: q.options.map((o) =>
                o.id === optionId ? { ...o, label } : o
              ),
            }
          : q
      )
    );
  };

  const removeOption = (id: string, optionId: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q
      )
    );
  };

  const toggleAllowMultiple = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? { ...q, allowMultiple: !q.allowMultiple }
          : q
      )
    );
  };

  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      moveQuestion(dragId, targetId);
    }
    setDragId(null);
  };

  const openPreview = () => {
    const payload = { title, questions };
    const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
    window.open(`/campaigns/preview?data=${encoded}`, "_blank");
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      const body = {
        title: title?.trim() || "Untitled campaign",
        form_schema: { version: 1, questions },
      };
      await updateCampaign(campaignId, body);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async () => {
    try {
      setIsSaving(true);
      const next = !published;
      const updated = await updateCampaign(campaignId, { is_published: next });
      // Reflect the authoritative DB state instead of optimistic toggle
      setPublished(
        Boolean((updated as any)?.is_published ?? (updated as any)?.published)
      );
      if (updated?.share_slug) setShareSlug(updated.share_slug);
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SignedOut>
          <RedirectToSignIn redirectUrl={`/campaigns/${campaignId}/edit`} />
        </SignedOut>
        <SignedIn>
          {/* Header row removed */}

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
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {title || "Untitled"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {published ? "Published" : "Draft"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={openPreview}
                    disabled={isSaving}
                  >
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    onClick={saveChanges}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    onClick={togglePublish}
                    disabled={isSaving}
                    className={
                      published
                        ? ""
                        : "bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white"
                    }
                  >
                    {isSaving
                      ? published
                        ? "Unpublishing…"
                        : "Publishing…"
                      : published
                      ? "Unpublish"
                      : "Publish"}
                  </Button>
                  {published && shareSlug && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const url = `${window.location.origin}/f/${shareSlug}`;
                        navigator.clipboard
                          .writeText(url)
                          .then(() =>
                            push({ title: "Share link copied", description: url })
                          )
                          .catch(() => window.open(url, "_blank"));
                      }}
                    >
                      Share link
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{title || "Untitled campaign"}</CardTitle>
                      <CardDescription>
                        Update your campaign details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <label className="text-sm font-medium">Title</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Eg. Downtown traffic improvements"
                        className="w-full h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Questions</CardTitle>
                        <CardDescription>
                          Drag to reorder. Click to edit.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={addShortText}
                          variant="outline"
                          className="gap-2"
                        >
                          <Type className="h-4 w-4" /> Short text
                        </Button>
                        <Button
                          onClick={addMultipleChoice}
                          variant="outline"
                          className="gap-2"
                        >
                          <ListChecks className="h-4 w-4" /> Multiple choice
                        </Button>
                        <Button
                          onClick={addContactInfo}
                          variant="outline"
                          className="gap-2"
                        >
                          <IdCard className="h-4 w-4" /> Contact info
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {questions.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No questions yet. Add one to get started.
                        </p>
                      )}
                      {questions.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-lg border p-3 bg-card"
                          draggable
                          onDragStart={() => onDragStart(q.id)}
                          onDragOver={onDragOver}
                          onDrop={() => onDrop(q.id)}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <input
                              className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
                              placeholder="Question title"
                              value={q.title}
                              onChange={(e) =>
                                updateQuestionTitle(q.id, e.target.value)
                              }
                            />
                            <Badge variant="secondary" className="capitalize">
                              {q.type.replace("_", " ")}
                            </Badge>
                            <Button
                              variant="ghost"
                              onClick={() => toggleRequired(q.id)}
                              className="text-xs"
                            >
                              {q.required ? "Required" : "Optional"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => removeQuestion(q.id)}
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {q.type === "short_text" && (
                            <div className="mt-3">
                              <label className="text-xs text-muted-foreground">
                                Placeholder
                              </label>
                              <input
                                className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
                                placeholder="Your answer..."
                                value={
                                  (q as ShortTextQuestion).placeholder || ""
                                }
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((qq) =>
                                      qq.id === q.id
                                        ? { ...qq, placeholder: e.target.value }
                                        : qq
                                    )
                                  )
                                }
                              />
                            </div>
                          )}

                          {q.type === "multiple_choice" && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">
                                  Options
                                </label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addOption(q.id)}
                                  className="h-7 px-2"
                                >
                                  Add option
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {(q as MultipleChoiceQuestion).options.map(
                                  (opt) => (
                                    <div
                                      key={opt.id}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
                                        placeholder="Option"
                                        value={opt.label}
                                        onChange={(e) =>
                                          updateOption(
                                            q.id,
                                            opt.id,
                                            e.target.value
                                          )
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          removeOption(q.id, opt.id)
                                        }
                                        className="h-7 px-2"
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  )
                                )}
                              </div>
                              <div className="pt-1">
                                <label className="inline-flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={
                                      (q as MultipleChoiceQuestion)
                                        .allowMultiple
                                    }
                                    onChange={() => toggleAllowMultiple(q.id)}
                                  />
                                  Allow multiple selections
                                </label>
                              </div>
                            </div>
                          )}
                          {q.type === "contact_info" && (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              This question will show fields for name, email,
                              and phone on the public form. Respondents can
                              leave them blank unless you mark this question as
                              required.
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </SignedIn>
      </main>
    </>
  );
}
