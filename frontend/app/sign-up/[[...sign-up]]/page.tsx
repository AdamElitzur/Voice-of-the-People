"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <SignUp signInUrl="/sign-in" afterSignUpUrl="/dashboard" />
    </div>
  );
}
