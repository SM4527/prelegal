"use client";

import { useEffect, useState, type ReactNode } from "react";
import { chat, type ConversationSummary } from "@/lib/api";
import { buttonPrimary, buttonSecondary, cardClass, errorClass, focusRing } from "@/lib/ui";
import { useUser } from "@/lib/user";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function Empty({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-3 px-8 py-16 text-center`}>
      <p className="text-lg font-semibold text-brand-navy">{title}</p>
      <p className="max-w-md text-sm text-slate-600">{text}</p>
      <div className="mt-2 flex gap-3">{children}</div>
    </div>
  );
}

function DocumentCard({ summary }: { summary: ConversationSummary }) {
  return (
    <li>
      <a
        href={`/?c=${summary.id}`}
        className={`${cardClass} flex h-full flex-col gap-2 p-5 transition hover:border-brand-blue hover:shadow-md ${focusRing}`}
      >
        <span className="font-semibold text-brand-navy">{summary.documentName}</span>
        <span className="text-sm text-slate-600">{summary.parties.join(" and ") || "Parties not named yet"}</span>
        <span className="mt-auto pt-2 text-xs text-slate-500">Updated {dateFormat.format(new Date(summary.updatedAt))}</span>
      </a>
    </li>
  );
}

/** The signed-in user's documents, each reopening in the creator; a sign-in prompt when signed out. */
export function DocumentHistory() {
  const user = useUser();
  const [documents, setDocuments] = useState<ConversationSummary[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (user) chat.list().then(setDocuments, () => setError(true));
  }, [user]);

  if (user === null) {
    return (
      <Empty title="Sign in to see your documents" text="Documents you draft while signed in are saved here, so you can pick up where you left off.">
        <a href="/signin/" className={buttonSecondary}>Sign in</a>
        <a href="/signup/" className={buttonPrimary}>Create an account</a>
      </Empty>
    );
  }
  if (error) return <p role="alert" className={errorClass}>Your documents could not be loaded. Please reload the page.</p>;
  if (!documents) return <p role="status" className="text-sm text-slate-500">Loading your documents...</p>;
  if (documents.length === 0) {
    return (
      <Empty title="No documents yet" text="Chat with the assistant to draft your first agreement. It will appear here.">
        <a href="/?new" className={buttonPrimary}>Start a document</a>
      </Empty>
    );
  }
  return (
    <ul aria-label="Documents" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((summary) => (
        <DocumentCard key={summary.id} summary={summary} />
      ))}
    </ul>
  );
}
