import { DISCLAIMER } from "@/lib/disclaimer";

/** The draft-only notice, as a banner above the document preview. */
export function Disclaimer() {
  return (
    <aside
      aria-label="Disclaimer"
      className="flex gap-3 rounded-xl border border-brand-yellow/50 bg-brand-yellow/10 px-4 py-3 text-sm text-slate-800"
    >
      <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-xs font-bold text-brand-navy">
        !
      </span>
      <p>
        <strong className="font-semibold text-brand-navy">Draft only. </strong>
        {DISCLAIMER}
      </p>
    </aside>
  );
}
