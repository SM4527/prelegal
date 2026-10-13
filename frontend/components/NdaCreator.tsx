"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { buildNdaMarkdown, defaultFormData, todayIso, type NdaTemplates } from "@/lib/nda";
import { DownloadButton } from "./DownloadButton";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

const noSubscription = () => () => {};

/**
 * Today's date, read during render without a hydration mismatch: the page is
 * prerendered at build time, so the server snapshot is empty and the browser
 * fills in the real date.
 */
function useToday(): string {
  return useSyncExternalStore(noSubscription, todayIso, () => "");
}

/** Holds the form state and keeps the live preview and PDF download in sync with it. */
export function NdaCreator({ templates }: { templates: NdaTemplates }) {
  const [form, setForm] = useState(defaultFormData);
  const today = useToday();
  // The form keeps the user's own (possibly blank) date; the document falls back to today.
  const markdown = useMemo(
    () => buildNdaMarkdown(templates, { ...form, effectiveDate: form.effectiveDate || today }),
    [templates, form, today],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <NdaForm data={form} onChange={setForm} />
        <DownloadButton markdown={markdown} />
      </div>
      <section aria-label="Mutual NDA preview" className="min-w-0">
        <NdaPreview markdown={markdown} />
      </section>
    </div>
  );
}
