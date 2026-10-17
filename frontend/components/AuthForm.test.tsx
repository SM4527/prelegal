// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const mocks = vi.hoisted(() => ({ signin: vi.fn(), signup: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  auth: mocks,
}));
vi.mock("@/lib/navigate", () => ({ navigate: mocks.navigate }));
const { ApiError } = await import("@/lib/api");

afterEach(() => vi.resetAllMocks());

async function submit(mode: "signin" | "signup", button: string) {
  render(<AuthForm mode={mode} />);
  await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret-password");
  await userEvent.click(screen.getByRole("button", { name: button }));
}

describe("AuthForm", () => {
  it.each([
    ["signin", "Sign in", "Sign up", "/signup/"],
    ["signup", "Sign up", "Sign in", "/signin/"],
  ] as const)("in %s mode submits the credentials, opens the creator and links to the other page", async (mode, button, link, href) => {
    mocks[mode].mockResolvedValue({ id: 1, email: "a@example.com" });

    await submit(mode, button);

    expect(mocks[mode]).toHaveBeenCalledWith({ email: "a@example.com", password: "secret-password" });
    expect(mocks.navigate).toHaveBeenCalledWith("/");
    expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", href);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the backend's message when the request fails", async () => {
    mocks.signin.mockRejectedValue(new ApiError(401, "Incorrect email or password."));
    await submit("signin", "Sign in");
    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(mocks.navigate).not.toHaveBeenCalled();
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
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
  });

  it("disables the button while signing in", async () => {
    mocks.signin.mockReturnValue(new Promise(() => {}));
    await submit("signin", "Sign in");
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
  });
});
