"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/api";
import type { ChatStatus } from "@/lib/useConversation";
import { ChatInput } from "./ChatInput";

interface NdaChatProps {
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
      className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
        isUser ? "self-end bg-brand-blue text-white" : "self-start bg-zinc-100 text-zinc-900"
      }`}
    >
      <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
      {content}
    </p>
  );
}

/** The conversation with the NDA assistant: message history, status, errors and the message box. */
export function NdaChat({ messages, pending, status, error, onSend, onRetry, onStartOver }: NdaChatProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const busy = status !== "idle";

  useEffect(() => {
    const log = logRef.current!;
    log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  return (
    <section aria-label="Assistant chat" className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-navy">NDA assistant</h2>
        <button type="button" onClick={onStartOver} disabled={busy} className="text-sm text-brand-blue underline disabled:opacity-50">
          Start over
        </button>
      </header>
      <div ref={logRef} role="log" aria-label="Conversation" className="flex h-80 flex-col gap-2 overflow-y-auto lg:h-[50vh]">
        {messages.map((message, i) => (
          <Bubble key={i} {...message} />
        ))}
        {pending && <Bubble role="user" content={pending} />}
      </div>
      <p role="status" className="min-h-5 text-xs text-brand-gray">
        {busy ? "Assistant is typing..." : ""}
      </p>
      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-red-700">
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
