// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/useConversation";
import { UserProvider } from "@/lib/user";
import { AppHeader } from "./AppHeader";

const mocks = vi.hoisted(() => ({ me: vi.fn(), signout: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  auth: { me: mocks.me, signout: mocks.signout },
}));
vi.mock("@/lib/navigate", () => ({ navigate: mocks.navigate }));

afterEach(() => vi.resetAllMocks());

const renderHeader = () => render(<UserProvider><AppHeader /></UserProvider>);

describe("AppHeader", () => {
  it("links to a new document and to My documents", () => {
    mocks.me.mockReturnValue(new Promise(() => {}));
    renderHeader();
    expect(screen.getByRole("link", { name: "New document" })).toHaveAttribute("href", "/?new");
    expect(screen.getByRole("link", { name: "My documents" })).toHaveAttribute("href", "/documents/");
    expect(screen.getByRole("link", { name: "Prelegal" })).toHaveAttribute("href", "/");
  });

  it("offers Sign in and Sign up when signed out", async () => {
    mocks.me.mockResolvedValue(null);
    renderHeader();
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin/");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup/");
  });

  it("shows the signed-in email, and Sign out forgets the conversation and reloads", async () => {
    mocks.me.mockResolvedValue({ id: 1, email: "a@example.com" });
    mocks.signout.mockResolvedValue(undefined);
    localStorage.setItem(STORAGE_KEY, "c1");
    renderHeader();

    expect(await screen.findByText("a@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signout).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });
});
