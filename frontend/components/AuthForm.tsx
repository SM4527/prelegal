"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiError, auth } from "@/lib/api";

type Mode = "signin" | "signup";

const COPY = {
  signin: { submit: "Sign in", switchText: "No account yet?", switchLabel: "Sign up", switchHref: "/signup/" },
  signup: { submit: "Sign up", switchText: "Already have an account?", switchLabel: "Sign in", switchHref: "/signin/" },
};

const controlClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";
const labelClass = "text-sm font-medium text-zinc-800";

/** Email and password form for signing in or up. Submits to the backend auth API. */
export function AuthForm({ mode }: { mode: Mode }) {
  const id = useId();
  const [error, setError] = useState("");
  const copy = COPY[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get("email")), password: String(form.get("password")) };
    setError("");
    try {
      await auth[mode](credentials);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" required className={controlClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-password`} className={labelClass}>Password</label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          className={controlClass}
        />
      </div>
      <button type="submit" className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        {copy.submit}
      </button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p className="text-sm text-brand-gray">
        {copy.switchText}{" "}
        <a href={copy.switchHref} className="font-medium text-brand-blue underline">{copy.switchLabel}</a>
      </p>
    </form>
  );
}
