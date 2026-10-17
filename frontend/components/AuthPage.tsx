import { cardClass } from "@/lib/ui";
import { AuthForm } from "./AuthForm";

const BENEFITS = [
  "Draft NDAs, cloud, data processing and other agreements by chat",
  "Pick up any document where you left off",
  "Download a ready-to-review PDF",
];

/** The sign-in and sign-up screens: what an account gives you, beside the form. */
export function AuthPage({ mode, title, subtitle }: { mode: "signin" | "signup"; title: string; subtitle: string }) {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-2">
      <section className="hidden flex-col gap-6 rounded-3xl bg-brand-navy p-10 text-white lg:flex">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-yellow">Prelegal</p>
        <p className="text-3xl font-semibold leading-tight">Common legal agreements, drafted in minutes.</p>
        <ul className="flex flex-col gap-3 text-sm text-slate-200">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-3">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-yellow" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>
      <section className={`${cardClass} mx-auto flex w-full max-w-md flex-col gap-6 p-8`}>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">{title}</h1>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
        <AuthForm mode={mode} />
      </section>
    </main>
  );
}
