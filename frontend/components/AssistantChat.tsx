"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/api";
import { buttonLink, cardClass } from "@/lib/ui";
import type { ChatStatus } from "@/lib/useConversation";
import { ChatInput } from "./ChatInput";

interface AssistantChatProps {
  messages: ChatMessage[];
  pending: string;
  status: ChatStatus;
  error: string;
  onSend: (text: string) => void;
  onRetry: () => void;
  onStartOver: () => void;
}

function Bubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <p
      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
        isUser ? "self-end rounded-br-sm bg-brand-blue text-white" : "self-start rounded-bl-sm bg-slate-100 text-slate-900"
      }`}
    >
      <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
      {content}
    </p>
  );
}

/** The conversation with the assistant: message history, status, errors and the message box. */
export function AssistantChat({ messages, pending, status, error, onSend, onRetry, onStartOver }: AssistantChatProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const busy = status !== "idle";

  useEffect(() => {
    const log = logRef.current!;
    log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  return (
    <section aria-label="Assistant chat" className={`${cardClass} flex flex-col gap-3 p-4`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
            AI
          </span>
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">Prelegal assistant</h2>
            <p className="text-xs text-slate-500">Drafts as you chat</p>
          </div>
        </div>
        <button type="button" onClick={onStartOver} disabled={busy} className={buttonLink}>
          New document
        </button>
      </header>
      <div ref={logRef} role="log" aria-label="Conversation" className="flex h-80 flex-col gap-2 overflow-y-auto lg:h-[50vh]">
        {messages.map((message, i) => (
          <Bubble key={i} {...message} />
        ))}
        {pending && <Bubble role="user" content={pending} />}
      </div>
      <p role="status" className="min-h-5 text-xs text-slate-500">
        {busy ? "Assistant is typing..." : ""}
      </p>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={onRetry} disabled={busy} className="font-medium underline disabled:opacity-50">
            Retry
          </button>
        </div>
      )}
      <ChatInput disabled={busy || messages.length === 0} onSend={onSend} />
    </section>
  );
}
