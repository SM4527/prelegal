// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, Conversation } from "@/lib/api";
import { defaultFormData, type NdaFormData } from "@/lib/nda";
import { loadNdaTemplates } from "@/lib/templates";
import { STORAGE_KEY } from "@/lib/useConversation";
import { DocumentCreator } from "./DocumentCreator";

const mocks = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  chat: mocks,
}));
const { ApiError } = await import("@/lib/api");

const templates = loadNdaTemplates();
const GREETING: ChatMessage = { role: "assistant", content: "Hi! Who are the two parties?" };

function conversation(fields: Partial<NdaFormData> = {}, messages: ChatMessage[] = [GREETING], id = "c1"): Conversation {
  return { id, messages, fields: { ...defaultFormData, ...fields } };
}

/** A conversation after the user said `text` and the assistant replied, with `fields` recorded. */
function afterTurn(text: string, reply: string, fields: Partial<NdaFormData> = {}) {
  return conversation(fields, [GREETING, { role: "user", content: text }, { role: "assistant", content: reply }]);
}

async function setup() {
  const user = userEvent.setup();
  render(<DocumentCreator templates={templates} />);
  const preview = screen.getByRole("region", { name: "Mutual NDA preview" });
  const log = screen.getByRole("log", { name: "Conversation" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  return { user, preview, log };
}

async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByRole("textbox", { name: "Message" }), text);
  await user.click(screen.getByRole("button", { name: "Send" }));
}

/** The preview's paragraph that follows a given cover-page heading. */
function sectionText(preview: HTMLElement, heading: string) {
  return within(preview).getByRole("heading", { name: heading }).nextElementSibling?.textContent;
}

/** The checkbox in the preview's list item that contains the given text. */
function previewCheckbox(preview: HTMLElement, text: RegExp) {
  const item = within(preview).getByText(text).closest("li")!;
  return within(item).getByRole("checkbox");
}

/** The preview signature-table row for a label, as [label, party1, party2]. */
function tableRow(preview: HTMLElement, label: string) {
  const row = within(preview).getByRole("cell", { name: label }).closest("tr")!;
  return within(row).getAllByRole("cell").map((cell) => cell.textContent);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 13, 12));
  localStorage.clear();
  mocks.create.mockResolvedValue(conversation());
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("DocumentCreator", () => {
  it("starts a conversation with the assistant's greeting and remembers it", async () => {
    const { log } = await setup();
    expect(within(log).getByText(GREETING.content)).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("c1");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("renders the full agreement with sensible defaults, using today while no date is chosen", async () => {
    const { preview } = await setup();
    expect(within(preview).getByRole("heading", { level: 2, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { level: 2, name: "Standard Terms" })).toBeInTheDocument();
    expect(sectionText(preview, "Purpose")).toBe(defaultFormData.purpose);
    expect(sectionText(preview, "Effective Date")).toBe("October 13, 2026");
    expect(previewCheckbox(preview, /Expires 1 year from Effective Date/)).toBeChecked();
    expect(previewCheckbox(preview, /1 year from Effective Date, but/)).toBeChecked();
    expect(within(preview).getByText("Governing Law: [Governing Law]")).toBeInTheDocument();
    expect(tableRow(preview, "Print Name")).toEqual(["Print Name", "[Print Name]", "[Print Name]"]);
    expect(sectionText(preview, "MNDA Modifications")).toBe("None.");
  });

  it("sends a message, shows it while waiting, then shows the reply and fills in the document", async () => {
    let reply!: (c: Conversation) => void;
    mocks.send.mockReturnValue(new Promise((resolve) => (reply = resolve)));
    const { user, preview, log } = await setup();

    await say(user, "Acme Inc. and Globex LLC, Delaware law");

    expect(mocks.send).toHaveBeenCalledWith("c1", "Acme Inc. and Globex LLC, Delaware law");
    expect(within(log).getByText("Acme Inc. and Globex LLC, Delaware law")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Assistant is typing...");
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    reply(
      afterTurn("Acme Inc. and Globex LLC, Delaware law", "Noted. Who signs for Acme?", {
        governingLaw: "Delaware",
        jurisdiction: "courts located in New Castle, DE",
        purpose: "Exploring a partnership",
        party1: { name: "", title: "", company: "Acme Inc.", noticeAddress: "" },
        party2: { name: "", title: "", company: "Globex LLC", noticeAddress: "" },
      }),
    );

    expect(await within(log).findByText("Noted. Who signs for Acme?")).toBeInTheDocument();
    expect(within(log).getAllByText("Acme Inc. and Globex LLC, Delaware law")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
    expect(within(preview).getByText("Jurisdiction: courts located in New Castle, DE")).toBeInTheDocument();
    expect(sectionText(preview, "Purpose")).toBe("Exploring a partnership");
    expect(tableRow(preview, "Company")).toEqual(["Company", "Acme Inc.", "Globex LLC"]);
  });

  it("labels each message with its speaker for screen readers", async () => {
    mocks.send.mockResolvedValue(afterTurn("Hello", "Hi again"));
    const { user, log } = await setup();
    await say(user, "Hello");

    const bubbles = await within(log).findAllByText(/Hello|Hi/);
    expect(bubbles.map((p) => p.textContent)).toEqual([
      `Assistant: ${GREETING.content}`,
      "You: Hello",
      "Assistant: Hi again",
    ]);
  });

  it("fills in dates, both term styles, parties and modifications from the assistant's fields", async () => {
    mocks.send.mockResolvedValue(
      afterTurn("All the details", "Done! You can download the PDF.", {
        effectiveDate: "2027-02-01",
        mndaTerm: { fixed: false, years: 3 },
        confidentialityTerm: { fixed: true, years: 5 },
        modifications: "First change\nSecond change",
        party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "1 Main St, Springfield" },
        party2: { name: "Alan Turing", title: "", company: "Globex LLC", noticeAddress: "" },
      }),
    );
    const { user, preview } = await setup();
    await say(user, "All the details");
    await screen.findByText("Done! You can download the PDF.");

    expect(sectionText(preview, "Effective Date")).toBe("February 1, 2027");
    expect(previewCheckbox(preview, /Continues until terminated/)).toBeChecked();
    expect(previewCheckbox(preview, /Expires \[N years\]/)).not.toBeChecked();
    expect(previewCheckbox(preview, /5 years from Effective Date, but/)).toBeChecked();
    expect(previewCheckbox(preview, /In perpetuity/)).not.toBeChecked();
    expect(tableRow(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
    expect(tableRow(preview, "Title")).toEqual(["Title", "CEO", "[Title]"]);
    expect(tableRow(preview, "Notice Address")).toEqual(["Notice Address", "1 Main St, Springfield", "[Notice Address]"]);
    expect(tableRow(preview, "Signature")).toEqual(["Signature", "", ""]);
    const modifications = within(preview).getByRole("heading", { name: "MNDA Modifications" }).nextElementSibling!;
    expect(modifications.querySelector("br")).not.toBeNull();
    expect(modifications.textContent).toBe("First change\nSecond change");
  });

  it("shows values and messages literally instead of interpreting markdown or HTML", async () => {
    const hostile = "*Acme* | <b>Ltd</b> [x](javascript:alert(1))";
    mocks.send.mockResolvedValue(
      afterTurn("hi", hostile, { party1: { ...defaultFormData.party1, company: hostile } }),
    );
    const { user, preview, log } = await setup();
    await say(user, "hi");
    await within(log).findByText(hostile);

    expect(tableRow(preview, "Company")[1]).toBe(hostile);
    expect(document.querySelector("b, em, script, a[href^='javascript']")).toBeNull();
  });

  it("sends with Enter and adds a new line with Shift+Enter", async () => {
    mocks.send.mockResolvedValue(afterTurn("Line one\nLine two", "Thanks"));
    const { user } = await setup();
    const box = screen.getByRole("textbox", { name: "Message" });

    await user.type(box, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(mocks.send).not.toHaveBeenCalled();
    await user.type(box, "{Enter}");

    expect(mocks.send).toHaveBeenCalledWith("c1", "Line one\nLine two");
  });

  it("ignores blank messages", async () => {
    const { user } = await setup();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "   {Enter}");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("shows an error when a message fails, and Retry sends it again", async () => {
    mocks.send
      .mockRejectedValueOnce(new ApiError(503, "The assistant is busy, please try again in a minute."))
      .mockResolvedValueOnce(afterTurn("Delaware", "Delaware it is."));
    const { user, log } = await setup();

    await say(user, "Delaware");

    expect(await screen.findByRole("alert")).toHaveTextContent("The assistant is busy, please try again in a minute.");
    expect(within(log).queryByText("Delaware")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await within(log).findByText("Delaware it is.")).toBeInTheDocument();
    expect(mocks.send).toHaveBeenLastCalledWith("c1", "Delaware");
    expect(within(log).getAllByText("Delaware")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a generic error on a network failure", async () => {
    mocks.send.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user } = await setup();
    await say(user, "Hello");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("lets the user retry when the conversation can't be started", async () => {
    mocks.create
      .mockRejectedValueOnce(new ApiError(503, "The assistant is busy, please try again in a minute."))
      .mockResolvedValueOnce(conversation());
    const user = userEvent.setup();
    render(<DocumentCreator templates={templates} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("The assistant is busy");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText(GREETING.content)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("resumes the stored conversation after a reload", async () => {
    localStorage.setItem(STORAGE_KEY, "c1");
    mocks.get.mockResolvedValue(afterTurn("Delaware law", "Got it.", { governingLaw: "Delaware" }));

    const { preview, log } = await setup();

    expect(mocks.get).toHaveBeenCalledWith("c1");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(within(log).getByText("Got it.")).toBeInTheDocument();
    expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
  });

  it("starts a new conversation when the stored one no longer exists", async () => {
    localStorage.setItem(STORAGE_KEY, "gone");
    mocks.get.mockRejectedValue(new ApiError(404, "Conversation not found."));
    mocks.create.mockResolvedValue(conversation({}, [GREETING], "c2"));

    await setup();

    expect(mocks.create).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("c2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("starts over with a fresh conversation and document", async () => {
    mocks.send.mockResolvedValue(afterTurn("Delaware", "Got it.", { governingLaw: "Delaware" }));
    mocks.create
      .mockResolvedValueOnce(conversation())
      .mockResolvedValueOnce(conversation({}, [{ role: "assistant", content: "Fresh start!" }], "c2"));
    const { user, preview, log } = await setup();
    await say(user, "Delaware");
    await within(log).findByText("Got it.");

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(await within(log).findByText("Fresh start!")).toBeInTheDocument();
    expect(within(log).queryByText("Got it.")).not.toBeInTheDocument();
    expect(within(preview).getByText("Governing Law: [Governing Law]")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("c2");
  });

  it("gives the preview's checkboxes accessible names", async () => {
    const { preview } = await setup();
    const checkboxes = within(preview).getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    for (const checkbox of checkboxes) {
      expect(checkbox).toHaveAccessibleName(/^(Selected|Not selected)$/);
    }
  });

  it("renders no h1 of its own, leaving that to the page", async () => {
    await setup();
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
  });

  it("offers a PDF download", async () => {
    await setup();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });
});
