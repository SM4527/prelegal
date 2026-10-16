import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";
import type { Conversation } from "../lib/api";
import { defaultFormData, type NdaFormData } from "../lib/nda";

const GREETING = "Hi! I'll help you draft a Mutual NDA. Who are the two parties?";

/** A scripted assistant reply: the fields it records, or an error response. */
type Turn = { reply: string; fields?: Partial<NdaFormData> } | { status: number; detail: string };

/**
 * Stubs the chat API with an in-memory backend so no LLM is called: each sent
 * message gets the next scripted turn. Then opens the page and waits for the greeting.
 */
async function openWithChat(page: Page, turns: Turn[] = []) {
  const conversations = new Map<string, Conversation>();
  await page.route("**/api/conversations**", async (route) => {
    const request = route.request();
    const [, , id] = new URL(request.url()).pathname.split("/").filter(Boolean);
    if (!id) {
      const created = { id: `c${conversations.size + 1}`, messages: [{ role: "assistant" as const, content: GREETING }], fields: defaultFormData };
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
    conversation.fields = { ...conversation.fields, ...turn.fields };
    return route.fulfill({ json: conversation });
  });
  await page.goto("/");
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
}

/** Types a message, sends it with the Send button, and waits for the assistant's reply. */
async function say(page: Page, text: string, reply: string) {
  await page.getByRole("textbox", { name: "Message" }).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(chatLog(page).getByText(reply)).toBeVisible();
}

/** Collects uncaught page errors and console errors so each test can assert there were none. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** Clicks Download PDF and returns the saved file name and its text. */
async function downloadPdf(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  const buffer = await readFile(await download.path());
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return { filename: download.suggestedFilename(), header: buffer.subarray(0, 5).toString(), text: text.replace(/\s+/g, " ") };
}

const preview = (page: Page) => page.getByRole("region", { name: "Mutual NDA preview" });
const chatLog = (page: Page) => page.getByRole("log", { name: "Conversation" });

test("loads the creator with the assistant's greeting, the full agreement and no errors", async ({ page }) => {
  const errors = trackErrors(page);
  await openWithChat(page);

  await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
  await expect(page.getByRole("heading", { level: 1, name: "Mutual NDA Creator" })).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "Mutual Non-Disclosure Agreement", exact: true })).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "Standard Terms" })).toBeAttached();
  await expect(preview(page)).toContainText("Governing Law: [Governing Law]");
  expect(errors).toEqual([]);
});

test("fills in today's date in the browser until a date is chosen", async ({ page }) => {
  await openWithChat(page);
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  );
  await expect(preview(page)).toContainText(today);
});

test("completes an NDA through the chat and downloads it as a PDF with the details", async ({ page }) => {
  const errors = trackErrors(page);
  await openWithChat(page, [
    {
      reply: "All set. You can download the PDF now.",
      fields: {
        purpose: "Evaluating a potential acquisition.",
        effectiveDate: "2026-12-01",
        mndaTerm: { fixed: true, years: 3 },
        confidentialityTerm: { fixed: false, years: 1 },
        governingLaw: "California",
        jurisdiction: "courts located in San Francisco, CA",
        modifications: "Section 6 retention limited to 30 days.",
        party1: { company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" },
        party2: { company: "Globex LLC", name: "Alan Turing", title: "CTO", noticeAddress: "alan@globex.test" },
      },
    },
  ]);

  await say(page, "Acme Inc. (Ada Lovelace, CEO) and Globex LLC (Alan Turing, CTO), California law...", "All set. You can download the PDF now.");

  await expect(preview(page)).toContainText("December 1, 2026");
  await expect(preview(page)).toContainText("Expires 3 years from Effective Date.");
  await expect(preview(page)).toContainText("Governing Law: California");

  const pdf = await downloadPdf(page);
  expect(pdf.filename).toBe("Mutual-NDA.pdf");
  expect(pdf.header).toBe("%PDF-");
  for (const expected of [
    "Evaluating a potential acquisition.",
    "December 1, 2026",
    "[X] Expires 3 years from Effective Date.",
    "[X] In perpetuity.",
    "Governing Law: California",
    "Jurisdiction: courts located in San Francisco, CA",
    "Section 6 retention limited to 30 days.",
    "Print Name Ada Lovelace Alan Turing",
    "Company Acme Inc. Globex LLC",
    "Notice Address ada@acme.test alan@globex.test",
    "Standard Terms",
  ]) {
    expect(pdf.text).toContain(expected);
  }
  expect(errors).toEqual([]);
});

test("downloads repeatedly, reflecting changes made in the chat between downloads", async ({ page }) => {
  await openWithChat(page, [
    { reply: "Delaware it is.", fields: { governingLaw: "Delaware" } },
    { reply: "Changed to New York.", fields: { governingLaw: "New York" } },
  ]);
  await say(page, "Delaware law", "Delaware it is.");
  expect((await downloadPdf(page)).text).toContain("Governing Law: Delaware");

  await say(page, "Actually, New York", "Changed to New York.");
  expect((await downloadPdf(page)).text).toContain("Governing Law: New York");
});

test("resumes the conversation after a reload", async ({ page }) => {
  await openWithChat(page, [{ reply: "Delaware it is.", fields: { governingLaw: "Delaware" } }]);
  await say(page, "Delaware law", "Delaware it is.");

  await page.reload();

  await expect(chatLog(page).getByText("Delaware it is.")).toBeVisible();
  await expect(chatLog(page).getByText("Delaware law")).toBeVisible();
  await expect(preview(page)).toContainText("Governing Law: Delaware");
});

test("starts over with a fresh conversation and document", async ({ page }) => {
  await openWithChat(page, [{ reply: "Delaware it is.", fields: { governingLaw: "Delaware" } }]);
  await say(page, "Delaware law", "Delaware it is.");

  await page.getByRole("button", { name: "Start over" }).click();

  await expect(chatLog(page).getByText("Delaware it is.")).toHaveCount(0);
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
  await expect(preview(page)).toContainText("Governing Law: [Governing Law]");
});

test("shows when the assistant is busy, and Retry resends the message", async ({ page }) => {
  await openWithChat(page, [
    { status: 503, detail: "The assistant is busy, please try again in a minute." },
    { reply: "Delaware it is.", fields: { governingLaw: "Delaware" } },
  ]);
  await page.getByRole("textbox", { name: "Message" }).fill("Delaware law");
  await page.getByRole("button", { name: "Send" }).click();

  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("The assistant is busy, please try again in a minute.");
  await alert.getByRole("button", { name: "Retry" }).click();

  await expect(chatLog(page).getByText("Delaware it is.")).toBeVisible();
  await expect(chatLog(page).getByText("Delaware law")).toHaveCount(1);
  await expect(alert).toHaveCount(0);
});

test("loads the PDF library only when downloading", async ({ page }) => {
  await openWithChat(page);
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  const initial = scripts.length;

  await downloadPdf(page);
  expect(scripts.length).toBeGreaterThan(initial);
});

test("shows an error when the PDF library can't load, and recovers once back online", async ({ page, context }) => {
  await openWithChat(page);
  trackErrors(page); // the failed chunk load is expected to log errors
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "could not be generated" })).toBeVisible();

  await context.setOffline(false);
  const pdf = await downloadPdf(page);
  expect(pdf.filename).toBe("Mutual-NDA.pdf");
  await expect(page.getByRole("alert").filter({ hasText: "could not be generated" })).toHaveCount(0);
});

test("can be used with the keyboard alone", async ({ page }) => {
  await openWithChat(page, [{ reply: "Delaware it is.", fields: { governingLaw: "Delaware" } }]);
  const box = page.getByRole("textbox", { name: "Message" });

  await box.focus();
  await page.keyboard.type("Delaware law");
  await page.keyboard.press("Enter");
  await expect(chatLog(page).getByText("Delaware it is.")).toBeVisible();
  await expect(box).toBeFocused();
  await expect(preview(page)).toContainText("Governing Law: Delaware");

  const download = page.getByRole("button", { name: "Download PDF" });
  await download.focus();
  const [file] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(file.suggestedFilename()).toBe("Mutual-NDA.pdf");
  await expect(download).toBeFocused();
});

test("shows chat messages and field values literally", async ({ page }) => {
  const hostile = "*Acme* | <img src=x onerror=alert(1)> [x](javascript:alert(1))";
  await openWithChat(page, [{ reply: `Recorded ${hostile}`, fields: { party1: { ...defaultFormData.party1, company: hostile } } }]);
  await say(page, hostile, `Recorded ${hostile}`);

  await expect(preview(page)).toContainText(hostile);
  await expect(page.locator("main img, main em, main a[href^='javascript']")).toHaveCount(0);
});

test("fits the viewport without horizontal scrolling", async ({ page }) => {
  await openWithChat(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
