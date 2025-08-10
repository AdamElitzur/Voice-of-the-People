"use client";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState, useTransition } from "react";
import { ensureAdmin, listDashboardCampaigns } from "@/app/actions/campaigns";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function DashboardPage() {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { push } = toast;
    ensureAdmin();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listDashboardCampaigns();
        setCampaigns(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <>
      <SiteHeader />
      <SignedOut>
        <RedirectToSignIn redirectUrl="/dashboard" />
      </SignedOut>
      <SignedIn>
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <Link
              href="/campaigns/new"
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white hover:from-blue-700 hover:via-sky-600 hover:to-red-700"
              )}
            >
              Start new campaign
            </Link>
          </div>
          {loading ? (
            <Card>
              <CardHeader>
                <CardTitle>Loading campaigns…</CardTitle>
                <CardDescription>Please wait</CardDescription>
              </CardHeader>
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No campaigns yet</CardTitle>
                <CardDescription>
                  Create your first campaign to start collecting responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href="/campaigns/new"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white hover:from-blue-700 hover:via-sky-600 hover:to-red-700"
                  )}
                >
                  Start new campaign
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((c) => (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{c.title}</CardTitle>
                      <CardDescription>
                        {new Intl.DateTimeFormat("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: "UTC",
                        }).format(new Date(c.created_at))}{" "}
                        · {c.response_count ?? 0} responses
                      </CardDescription>
                    </div>
                    <Badge variant={c.is_published ? "default" : "secondary"}>
                      {c.is_published ? "Published" : "Draft"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Link
                      href={`/campaigns/${c.id}/edit`}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/campaigns/preview?data=${encodeURIComponent(
                        btoa(
                          JSON.stringify({
                            title: c.title,
                            questions: c.form_schema?.questions || [],
                          })
                        )
                      )}`}
                      target="_blank"
                      className={cn(buttonVariants({ variant: "ghost" }))}
                    >
                      Preview
                    </Link>
                    <Link
                      href={`/campaigns/${c.id}/analytics`}
                      className={cn(buttonVariants({ variant: "ghost" }))}
                    >
                      Analytics
                    </Link>
                    {c.share_slug && c.is_published && (
                      <ShareLinkButton slug={c.share_slug} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </SignedIn>
    </>
  );
}

function ShareLinkButton({ slug }: { slug: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "ghost" }))}
      onClick={() => {
        const url = `${window.location.origin}/f/${slug}`;
        navigator.clipboard
          .writeText(url)
          .then(() => push({ title: "Share link copied", description: url }))
          .catch(() => window.open(url, "_blank"));
      }}
    >
      Share link
    </button>
  );
}
