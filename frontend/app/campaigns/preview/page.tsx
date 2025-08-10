"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";

type QuestionType = "short_text" | "multiple_choice";
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
    };

export default function CampaignPreviewPage() {
  const [data, setData] = useState<{
    title: string;
    questions: Question[];
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("data");
    if (!encoded) return;
    try {
      const json = JSON.parse(atob(decodeURIComponent(encoded)));
      setData(json);
    } catch (e) {
      console.error("Invalid preview data");
    }
  }, []);

  if (!data) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <SignedOut>
            <RedirectToSignIn redirectUrl="/campaigns/preview" />
          </SignedOut>
          <SignedIn>
            <header className="mb-6 flex items-center justify-between">
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "ghost" }))}
              >
                Back to dashboard
              </Link>
              <div className="text-sm text-muted-foreground">
                Campaign preview
              </div>
            </header>
            <p className="text-sm text-muted-foreground">No preview data.</p>
          </SignedIn>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <SignedOut>
          <RedirectToSignIn redirectUrl="/campaigns/preview" />
        </SignedOut>
        <SignedIn>
          <header className="mb-6 flex items-center justify-between">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Back to dashboard
            </Link>
            <div className="text-sm text-muted-foreground">
              Campaign preview
            </div>
          </header>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              {data.title || "Untitled campaign"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Previewing public form
            </p>
          </div>

          <form className="space-y-6">
            {data.questions.map((q) => (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base">{q.title}</CardTitle>
                  {q.required && <CardDescription>Required</CardDescription>}
                </CardHeader>
                <CardContent>
                  {q.type === "short_text" && (
                    <input
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
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.close()}
              >
                Close preview
              </Button>
            </div>
          </form>
        </SignedIn>
      </main>
    </>
  );
}
