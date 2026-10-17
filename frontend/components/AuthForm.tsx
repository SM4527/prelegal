"use client";

import { useId, useState, type FormEvent } from "react";
import { ApiError, auth } from "@/lib/api";
import { navigate } from "@/lib/navigate";
import { buttonPrimary, errorClass, inputClass, labelClass, linkClass } from "@/lib/ui";

type Mode = "signin" | "signup";

const COPY = {
  signin: {
    submit: "Sign in",
    busy: "Signing in...",
    switchText: "No account yet?",
    switchLabel: "Sign up",
    switchHref: "/signup/",
  },
  signup: {
    submit: "Sign up",
    busy: "Creating account...",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/signin/",
  },
};

/** Email and password form for signing in or up. On success it opens the document creator, signed in. */
export function AuthForm({ mode }: { mode: Mode }) {
  const id = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get("email")), password: String(form.get("password")) };
    setError("");
    setBusy(true);
    try {
      await auth[mode](credentials);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className={labelClass}>Email</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-password`} className={labelClass}>Password</label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 8 : undefined}
          aria-describedby={mode === "signup" ? `${id}-hint` : undefined}
          required
          className={inputClass}
        />
        {mode === "signup" && <p id={`${id}-hint`} className="text-xs text-slate-500">At least 8 characters.</p>}
      </div>
      <button type="submit" disabled={busy} className={buttonPrimary}>
        {busy ? copy.busy : copy.submit}
      </button>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      <p className="text-center text-sm text-slate-600">
        {copy.switchText}{" "}
        <a href={copy.switchHref} className={linkClass}>{copy.switchLabel}</a>
      </p>
    </form>
  );
}
