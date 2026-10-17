import type { Metadata } from "next";
import { AuthPage } from "@/components/AuthPage";

export const metadata: Metadata = { title: "Sign in" };

export default function SignIn() {
  return <AuthPage mode="signin" title="Sign in to Prelegal" subtitle="Welcome back. Your documents are waiting." />;
}
