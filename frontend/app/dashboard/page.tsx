"use client";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  // Data integration pending: will load campaigns/responses from API/database.
  return (
    <>
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
          <Card>
            <CardHeader>
              <CardTitle>No campaigns yet</CardTitle>
              <CardDescription>Create your first campaign to start collecting responses</CardDescription>
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
        </main>
      </SignedIn>
    </>
  );
}


