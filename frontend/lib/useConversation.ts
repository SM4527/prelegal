"use client";

import { useEffect, useState } from "react";
import { ApiError, chat, type Conversation } from "./api";

/** Remembers the conversation across page reloads. The backend forgets it when it restarts. */
export const STORAGE_KEY = "prelegal.conversationId";

export type ChatStatus = "loading" | "idle" | "sending";

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

/**
 * Opens the conversation named in the URL (`/?c=<id>`, from My documents), or resumes the stored one, or
 * starts a new one (`/?new`, or nothing stored). An id the backend no longer knows starts afresh.
 */
async function resumeOrCreate(): Promise<Conversation> {
  const params = new URLSearchParams(window.location.search);
  if (params.size) window.history.replaceState(null, "", window.location.pathname);
  const id = params.has("new") ? null : (params.get("c") ?? localStorage.getItem(STORAGE_KEY));
  if (!id) return chat.create();
  try {
    return await chat.get(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return chat.create();
    throw error;
  }
}

/**
 * The chat with the assistant: the conversation, what is in flight, and the
 * actions the chat panel offers. A failed message can be retried as-is.
 */
export function useConversation() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [status, setStatus] = useState<ChatStatus>("loading");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [failedText, setFailedText] = useState("");

  function run(request: () => Promise<Conversation>, text = "") {
    setStatus(text ? "sending" : "loading");
    setPending(text);
    setError("");
    return settle(request, text);
  }

  /** Awaits the request, then shows its conversation or its error. */
  async function settle(request: () => Promise<Conversation>, text: string) {
    try {
      const result = await request();
      localStorage.setItem(STORAGE_KEY, result.id);
      setConversation(result);
      setFailedText("");
    } catch (err) {
      setError(errorText(err));
      setFailedText(text);
    } finally {
      setPending("");
      setStatus("idle");
    }
  }

  useEffect(() => {
    // Runs once on mount, starting from the initial "loading" state.
    void settle(resumeOrCreate, "");
  }, []);

  const send = (text: string) => run(() => chat.send(conversation!.id, text), text);

  return {
    messages: conversation?.messages ?? [],
    document: conversation?.document ?? null,
    fields: conversation?.fields,
    status,
    pending,
    error,
    send,
    retry: () => (conversation ? send(failedText) : run(chat.create)),
    startOver: () => {
      localStorage.removeItem(STORAGE_KEY);
      setConversation(null);
      return run(chat.create);
    },
  };
}
