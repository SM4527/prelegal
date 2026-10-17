import type { Page } from "@playwright/test";
import type { Conversation, ConversationSummary } from "../lib/api";
import type { DocumentFields } from "../lib/documents";
import { defaultFormData, type NdaFormData } from "../lib/nda";

export const GREETING = "Hi! I can draft NDAs, cloud service agreements and more. What do you need?";
const emptyParty = { name: "", title: "", company: "", noticeAddress: "" };
const NDA_FIELDS = defaultFormData as unknown as DocumentFields;

/** A scripted assistant reply: the document it chooses and the fields it records, or an error response. */
export type Turn =
  | { reply: string; document?: string; fields?: Partial<NdaFormData> | Record<string, unknown> }
  | { status: number; detail: string };

/**
 * Stubs the chat API with an in-memory backend so no LLM is called: each sent
 * message gets the next scripted turn. Conversations start on `document`
 * (the Mutual NDA unless null). Listing returns those with a document, newest first.
 * Returns the conversations, so a test can add its own.
 */
export async function stubChat(page: Page, turns: Turn[] = [], document: string | null = "mutual-nda") {
  const conversations = new Map<string, Conversation>();
  await page.route("**/api/conversations**", async (route) => {
    const request = route.request();
    const [, , id] = new URL(request.url()).pathname.split("/").filter(Boolean);
    if (!id && request.method() === "GET") {
      const listed: ConversationSummary[] = [...conversations.values()]
        .filter((c) => c.document)
        .reverse()
        .map((c) => ({ id: c.id, document: c.document!, documentName: "Mutual Non-Disclosure Agreement", parties: [], updatedAt: "2026-10-17T09:30:00.000Z" }));
      return route.fulfill({ json: listed });
    }
    if (!id) {
      const created: Conversation = {
        id: `c${conversations.size + 1}`,
        messages: [{ role: "assistant", content: GREETING }],
        document,
        fields: document ? NDA_FIELDS : { party1: emptyParty, party2: emptyParty },
      };
      conversations.set(created.id, created);
      return route.fulfill({ status: 201, json: created });
    }
    const conversation = conversations.get(id);
    if (!conversation) return route.fulfill({ status: 404, json: { detail: "Conversation not found." } });
    if (request.method() === "GET") return route.fulfill({ json: conversation });

    const turn = turns.shift()!;
    if ("status" in turn) return route.fulfill({ status: turn.status, json: { detail: turn.detail } });
    conversation.messages = [
      ...conversation.messages,
      { role: "user", content: request.postDataJSON().content },
      { role: "assistant", content: turn.reply },
    ];
    conversation.document = turn.document ?? conversation.document;
    conversation.fields = { ...conversation.fields, ...turn.fields } as DocumentFields;
    return route.fulfill({ json: conversation });
  });
  return conversations;
}
