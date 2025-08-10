"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <SignIn signUpUrl="/sign-up" afterSignInUrl="/dashboard" />
    </div>
  );
}
