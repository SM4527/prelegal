"use client";

import { useMemo, useSyncExternalStore } from "react";
import { buildDocumentMarkdown, type DocumentInfo } from "@/lib/documents";
import { todayIso } from "@/lib/nda";
import { cardClass } from "@/lib/ui";
import { useConversation } from "@/lib/useConversation";
import { useUser } from "@/lib/user";
import { AssistantChat } from "./AssistantChat";
import { Disclaimer } from "./Disclaimer";
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

/** Encourages a signed-out user to sign in, so the draft is saved to an account. */
function SaveNotice() {
  return (
    <p className={`${cardClass} px-4 py-3 text-sm text-slate-600`}>
      <a href="/signin/" className="font-semibold text-brand-blue hover:underline">Sign in</a> or{" "}
      <a href="/signup/" className="font-semibold text-brand-blue hover:underline">create an account</a> to save
      this document and come back to it later.
    </p>
  );
}

/**
 * Chat with the assistant on the left. Once it has worked out which document the
 * user needs, the live preview and PDF download follow the fields it fills in.
 */
export function DocumentCreator({ documents }: { documents: Record<string, DocumentInfo> }) {
  const chat = useConversation();
  const user = useUser();
  const doc = chat.document ? documents[chat.document] : null;
  const today = useToday();
  const markdown = useMemo(
    () => (doc && chat.fields ? buildDocumentMarkdown(doc, chat.fields, today) : ""),
    [doc, chat.fields, today],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto lg:pr-2">
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
        {user === null && <SaveNotice />}
      </div>
      <section aria-label="Document preview" className="flex min-w-0 flex-col gap-4">
        {doc ? (
          <>
            <Disclaimer />
            <DocumentPreview markdown={markdown} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-8 py-20 text-center">
            <p className="text-base font-semibold text-brand-navy">Your agreement will appear here</p>
            <p className="max-w-sm text-sm text-slate-500">
              Once you and the assistant have picked which one you need, the preview fills in as you answer.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
