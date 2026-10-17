"use client";

import { auth } from "@/lib/api";
import { navigate } from "@/lib/navigate";
import { buttonPrimary, buttonSecondary } from "@/lib/ui";
import { STORAGE_KEY } from "@/lib/useConversation";
import { useUser } from "@/lib/user";
import { Logo } from "./Logo";

const navLink = "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-navy";

async function signOut() {
  await auth.signout();
  localStorage.removeItem(STORAGE_KEY);
  navigate("/");
}

/** Logo and navigation; the account's email and Sign out, or Sign in and Sign up when signed out. */
export function AppHeader() {
  const user = useUser();
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
        <Logo />
        {/* Below the logo and account buttons on small screens, beside the logo otherwise. */}
        <nav aria-label="Main" className="order-last -mx-3 flex w-full items-center gap-1 sm:order-none sm:mx-0 sm:w-auto">
          <a href="/?new" className={navLink}>New document</a>
          <a href="/documents/" className={navLink}>My documents</a>
        </nav>
        {user && (
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{user.email}</span>
            <button type="button" onClick={signOut} className={buttonSecondary}>Sign out</button>
          </div>
        )}
        {user === null && (
          <div className="ml-auto flex items-center gap-2">
            <a href="/signin/" className={buttonSecondary}>Sign in</a>
            <a href="/signup/" className={buttonPrimary}>Sign up</a>
          </div>
        )}
      </div>
    </header>
  );
}
