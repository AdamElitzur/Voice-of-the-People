"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";

export function SiteHeader() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const isLanding = pathname === "/";
  const isPublicForm = pathname?.startsWith("/f/") || pathname === "/f";
  const logoHref = isSignedIn && !isLanding ? "/dashboard" : "/";
  return (
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href={logoHref} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 animate-pulse" />
          <span className="text-lg font-semibold tracking-tight">
            Voice of the People
          </span>
        </Link>
        {!isPublicForm && (
          <nav className="flex items-center gap-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" className="hidden sm:inline-flex">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                <Button className="bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white hover:from-blue-700 hover:via-sky-600 hover:to-red-700">
                  Get started
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "hidden sm:inline-flex"
                )}
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </nav>
        )}
      </div>
    </header>
  );
}
