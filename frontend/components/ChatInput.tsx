"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

/** Message box and Send button. Enter sends; Shift+Enter starts a new line. */
export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState("");

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (disabled || !message) return;
    onSend(message);
    setText("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor={id} className="sr-only">Message</label>
      <textarea
        id={id}
        rows={2}
        value={text}
        maxLength={4000}
        placeholder="Type your answer..."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-w-0 flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
