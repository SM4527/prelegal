"use client";

import { useMemo, useSyncExternalStore } from "react";
import { buildDocumentMarkdown, type DocumentInfo } from "@/lib/documents";
import { todayIso } from "@/lib/nda";
import { useConversation } from "@/lib/useConversation";
import { AssistantChat } from "./AssistantChat";
import { DocumentPreview } from "./DocumentPreview";
import { DownloadButton } from "./DownloadButton";

const noSubscription = () => () => {};

/**
 * Today's date, read during render without a hydration mismatch: the page is
 * prerendered at build time, so the server snapshot is empty and the browser
 * fills in the real date.
 */
function useToday(): string {
  return useSyncExternalStore(noSubscription, todayIso, () => "");
}

/**
 * Chat with the assistant on the left. Once it has worked out which document the
 * user needs, the live preview and PDF download follow the fields it fills in.
 */
export function DocumentCreator({ documents }: { documents: Record<string, DocumentInfo> }) {
  const chat = useConversation();
  const doc = chat.document ? documents[chat.document] : null;
  const today = useToday();
  const markdown = useMemo(
    () => (doc && chat.fields ? buildDocumentMarkdown(doc, chat.fields, today) : ""),
    [doc, chat.fields, today],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <AssistantChat
          messages={chat.messages}
          pending={chat.pending}
          status={chat.status}
          error={chat.error}
          onSend={chat.send}
          onRetry={chat.retry}
          onStartOver={chat.startOver}
        />
        {doc && <DownloadButton markdown={markdown} title={doc.name} filename={doc.filename} />}
      </div>
      <section aria-label="Document preview" className="min-w-0">
        {doc ? (
          <DocumentPreview markdown={markdown} />
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-brand-gray">
            Your agreement will appear here once you and the assistant have picked which one you need.
          </p>
        )}
      </section>
    </div>
  );
}
