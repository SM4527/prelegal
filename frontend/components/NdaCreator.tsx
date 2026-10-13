"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { buildNdaMarkdown, defaultFormData, todayIso, type NdaTemplates } from "@/lib/nda";
import { DownloadButton } from "./DownloadButton";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

const noSubscription = () => () => {};

/**
 * The page is prerendered at build time, so "today" is only known in the browser.
 * The server snapshot is empty, which renders the Effective Date placeholder.
 */
function useToday(): string {
  return useSyncExternalStore(noSubscription, todayIso, () => "");
}

/** Holds the form state and keeps the live preview and PDF download in sync with it. */
export function NdaCreator({ templates }: { templates: NdaTemplates }) {
  const [form, setForm] = useState(defaultFormData);
  const today = useToday();
  // An Effective Date the user hasn't chosen defaults to today.
  const data = useMemo(() => (form.effectiveDate ? form : { ...form, effectiveDate: today }), [form, today]);
  const markdown = useMemo(() => buildNdaMarkdown(templates, data), [templates, data]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <NdaForm data={data} onChange={setForm} />
        <DownloadButton markdown={markdown} />
      </aside>
      <section aria-label="Mutual NDA preview" className="min-w-0">
        <NdaPreview markdown={markdown} />
      </section>
    </div>
  );
}
