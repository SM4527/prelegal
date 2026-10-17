// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "@/lib/user";
import { DocumentHistory } from "./DocumentHistory";

const mocks = vi.hoisted(() => ({ me: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  auth: { me: mocks.me },
  chat: { list: mocks.list },
}));
const { ApiError } = await import("@/lib/api");

afterEach(() => vi.resetAllMocks());

const renderHistory = () => render(<UserProvider><DocumentHistory /></UserProvider>);
const signedIn = () => mocks.me.mockResolvedValue({ id: 1, email: "a@example.com" });

describe("DocumentHistory", () => {
  it("lists the user's documents, each linking back to the creator", async () => {
    signedIn();
    mocks.list.mockResolvedValue([
      { id: "c2", document: "csa", documentName: "Cloud Service Agreement", parties: ["Acme Inc", "Globex LLC"], updatedAt: "2026-10-17T09:30:00.000Z" },
      { id: "c1", document: "mutual-nda", documentName: "Mutual Non-Disclosure Agreement", parties: [], updatedAt: "2026-10-16T09:30:00.000Z" },
    ]);
    renderHistory();

    const items = within(await screen.findByRole("list", { name: "Documents" })).getAllByRole("link");
    expect(items.map((item) => item.getAttribute("href"))).toEqual(["/?c=c2", "/?c=c1"]);
    expect(items[0]).toHaveTextContent("Cloud Service Agreement");
    expect(items[0]).toHaveTextContent("Acme Inc and Globex LLC");
    expect(items[0]).toHaveTextContent(/Updated .*2026/);
    expect(items[1]).toHaveTextContent("Parties not named yet");
  });

  it("invites the user to start a document when there are none", async () => {
    signedIn();
    mocks.list.mockResolvedValue([]);
    renderHistory();
    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a document" })).toHaveAttribute("href", "/?new");
  });

  it("asks a signed-out visitor to sign in, without fetching", async () => {
    mocks.me.mockResolvedValue(null);
    renderHistory();
    expect(await screen.findByText("Sign in to see your documents")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin/");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup/");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("says when the documents could not be loaded", async () => {
    signedIn();
    mocks.list.mockRejectedValue(new ApiError(503, "Unavailable"));
    renderHistory();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your documents could not be loaded.");
  });
});
