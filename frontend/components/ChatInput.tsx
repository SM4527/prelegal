"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { buttonPrimary, inputClass } from "@/lib/ui";

/**
 * Message box and Send button. Enter sends; Shift+Enter starts a new line. Focus stays in the
 * message box: after sending, and whenever it becomes usable again (e.g. when a reply arrives).
 */
export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) box.current!.focus();
  }, [disabled]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (disabled || !message) return;
    onSend(message);
    setText("");
    box.current!.focus();
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
        ref={box}
        id={id}
        rows={2}
        value={text}
        maxLength={4000}
        placeholder="Type your answer..."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${inputClass} min-w-0 flex-1 resize-none`}
      />
      <button
        type="submit"
        disabled={disabled}
        className={buttonPrimary}
      >
        Send
      </button>
    </form>
  );
}
