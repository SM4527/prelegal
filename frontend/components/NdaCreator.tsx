"use client";

import { useMemo, useSyncExternalStore } from "react";
import { buildNdaMarkdown, defaultFormData, todayIso, type NdaTemplates } from "@/lib/nda";
import { useConversation } from "@/lib/useConversation";
import { DownloadButton } from "./DownloadButton";
import { NdaChat } from "./NdaChat";
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

/** Chat with the assistant on the left; the live preview and PDF download follow the fields it fills in. */
export function NdaCreator({ templates }: { templates: NdaTemplates }) {
  const chat = useConversation();
  const fields = chat.fields ?? defaultFormData;
  const today = useToday();
  // The fields keep the (possibly blank) chosen date; the document falls back to today.
  const markdown = useMemo(
    () => buildNdaMarkdown(templates, { ...fields, effectiveDate: fields.effectiveDate || today }),
    [templates, fields, today],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <NdaChat
          messages={chat.messages}
          pending={chat.pending}
          status={chat.status}
          error={chat.error}
          onSend={chat.send}
          onRetry={chat.retry}
          onStartOver={chat.startOver}
        />
        <DownloadButton markdown={markdown} />
      </div>
      <section aria-label="Mutual NDA preview" className="min-w-0">
        <NdaPreview markdown={markdown} />
      </section>
    </div>
  );
}
