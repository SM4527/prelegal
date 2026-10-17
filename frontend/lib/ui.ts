/** Shared Tailwind classes, so every screen uses the same controls. */

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2";

export const buttonPrimary = `inline-flex items-center justify-center rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90 disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60 ${focusRing}`;

export const buttonSecondary = `inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50 disabled:opacity-50 ${focusRing}`;

export const buttonLink = `rounded text-sm font-medium text-brand-blue underline-offset-4 hover:underline disabled:opacity-50 ${focusRing}`;

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30";

export const labelClass = "text-sm font-medium text-slate-700";

export const cardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

export const errorClass = "text-sm text-red-700";
