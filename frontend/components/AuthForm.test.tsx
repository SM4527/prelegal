// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const mocks = vi.hoisted(() => ({ signin: vi.fn(), signup: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  auth: mocks,
}));
const { ApiError } = await import("@/lib/api");

afterEach(() => vi.resetAllMocks());

async function submit(mode: "signin" | "signup", button: string) {
  render(<AuthForm mode={mode} />);
  await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret");
  await userEvent.click(screen.getByRole("button", { name: button }));
}

describe("AuthForm", () => {
  it.each([
    ["signin", "Sign in", "Sign up", "/signup/"],
    ["signup", "Sign up", "Sign in", "/signin/"],
  ] as const)("in %s mode submits the credentials and links to the other page", async (mode, button, link, href) => {
    mocks[mode].mockResolvedValue({ id: 1, email: "a@example.com" });

    await submit(mode, button);

    expect(mocks[mode]).toHaveBeenCalledWith({ email: "a@example.com", password: "secret" });
    expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", href);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the backend's message when the request fails", async () => {
    mocks.signin.mockRejectedValue(new ApiError(501, "Accounts are not available yet."));
    await submit("signin", "Sign in");
    expect(screen.getByRole("alert")).toHaveTextContent("Accounts are not available yet.");
  });

  it("shows a generic message on a network error", async () => {
    mocks.signup.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit("signup", "Sign up");
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
  });

  it("requires both fields and uses password-manager-friendly autocomplete", () => {
    render(<AuthForm mode="signup" />);
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
  });
});
