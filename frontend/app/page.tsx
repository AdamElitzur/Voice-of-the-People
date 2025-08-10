import Link from "next/link";
import { Megaphone, Users, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-white to-slate-50 dark:from-[#0b1020] dark:to-background">
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 animate-pulse" />
            <span className="text-lg font-semibold tracking-tight">
              Voice of the People
            </span>
          </Link>
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-16 md:py-24 text-center">
          <div className="mx-auto max-w-2xl">
            <Badge className="mx-auto mb-4 bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white border-none">
              Democracy, amplified
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              {/* Your voice, counted. */}
              Kahoot, for politics.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A platform for politicians to understand public sentiment in real
              time.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <SignedOut>
                <SignUpButton mode="modal" fallbackRedirectUrl="/dashboard">
                  <Button className="bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white hover:from-blue-700 hover:via-sky-600 hover:to-red-700 transition-shadow hover:shadow-lg">
                    Start a campaign
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "bg-gradient-to-r from-blue-600 via-sky-500 to-red-600 text-white hover:from-blue-700 hover:via-sky-600 hover:to-red-700 transition-shadow hover:shadow-lg"
                  )}
                >
                  Start a campaign
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>

        <section className="pb-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-blue-600/10 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Megaphone className="h-5 w-5" />
              </div>
              <CardTitle>Instant Insights</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Get immediate feedback with live polling and quizzes that capture
              genuine public sentiment.
            </CardContent>
          </Card>

          <Card className="border-2 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-sky-600/10 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle>Visualize Results</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Visualize results as they come in, enabling fast and informed
              decision-making based on what matters most to your community.
            </CardContent>
          </Card>

          <Card className="border-2 transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-red-600/10 text-red-700 dark:text-red-300 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Inclusive Engagement</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Encourage honest input with anonymous participation accessible on
              mobile and desktop.
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Voice of the People</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:underline">
              Privacy
            </Link>
            <Link href="#" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
