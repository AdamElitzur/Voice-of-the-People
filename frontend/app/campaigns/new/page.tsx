"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, Trash2, Type, ListChecks } from "lucide-react";

type QuestionType = "short_text" | "multiple_choice";

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

type Question = ShortTextQuestion | MultipleChoiceQuestion;

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function NewCampaignPage() {
  const [title, setTitle] = useState<string>("Untitled campaign");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

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
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, title: newTitle } : q)));
  };

  const toggleRequired = (id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, required: !q.required } : q)));
  };

  const addOption = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? {
              ...q,
              options: [...q.options, { id: generateId("opt"), label: `Option ${q.options.length + 1}` }],
            }
          : q
      )
    );
  };

  const updateOption = (id: string, optionId: string, label: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === "multiple_choice"
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, label } : o)) }
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
      prev.map((q) => (q.id === id && q.type === "multiple_choice" ? { ...q, allowMultiple: !q.allowMultiple } : q))
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
          <p className="text-sm text-muted-foreground">Build a form to gather public input</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openPreview}>Preview</Button>
          <Button variant="outline">Save draft</Button>
          <Button className="bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white">Publish</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{title || "Untitled campaign"}</CardTitle>
              <CardDescription>Give your campaign a clear title</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">Title</label>
              <input
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
                <CardDescription>Drag to reorder. Click to edit.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={addShortText} variant="outline" className="gap-2"><Type className="h-4 w-4" /> Short text</Button>
                <Button onClick={addMultipleChoice} variant="outline" className="gap-2"><ListChecks className="h-4 w-4" /> Multiple choice</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground">No questions yet. Add one to get started.</p>
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
                      onChange={(e) => updateQuestionTitle(q.id, e.target.value)}
                    />
                    <Badge variant="secondary" className="capitalize">{q.type.replace("_", " ")}</Badge>
                    <Button variant="ghost" onClick={() => toggleRequired(q.id)} className="text-xs">
                      {q.required ? "Required" : "Optional"}
                    </Button>
                    <Button variant="ghost" onClick={() => removeQuestion(q.id)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {q.type === "short_text" && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground">Placeholder</label>
                      <input
                        className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm"
                        placeholder="Your answer..."
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((qq) => (qq.id === q.id ? { ...qq, placeholder: e.target.value } : qq))
                          )
                        }
                      />
                    </div>
                  )}

                  {q.type === "multiple_choice" && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Options</label>
                        <Button variant="outline" size="sm" onClick={() => addOption(q.id)} className="h-7 px-2">Add option</Button>
                      </div>
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              className="flex-1 h-9 rounded-md border bg-background px-2 text-sm"
                              placeholder="Option"
                              onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                            />
                            <Button variant="ghost" size="sm" onClick={() => removeOption(q.id, opt.id)} className="h-7 px-2">Remove</Button>
                          </div>
                        ))}
                      </div>
                      <div className="pt-1">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={q.allowMultiple}
                            onChange={() => toggleAllowMultiple(q.id)}
                          />
                          Allow multiple selections
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      </div>
    </main>
  );
}


