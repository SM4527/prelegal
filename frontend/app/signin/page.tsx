import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignIn() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">Sign in to Prelegal</h1>
      <AuthForm mode="signin" />
    </main>
  );
}
