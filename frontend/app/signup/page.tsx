import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUp() {
  return (
    <AuthPage mode="signup" title="Create your Prelegal account" subtitle="Save your drafts and come back to them anytime." />
  );
}
