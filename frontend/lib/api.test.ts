import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, auth } from "./api";

const credentials = { email: "a@example.com", password: "secret" };

function mockFetch(status: number, body: unknown, statusText = "") {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const fetchMock = vi.fn().mockResolvedValue(new Response(text, { status, statusText }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("auth API client", () => {
  it.each([
    ["signup", "/api/auth/signup"],
    ["signin", "/api/auth/signin"],
  ] as const)("%s posts the credentials as JSON to %s", async (method, url) => {
    const fetchMock = mockFetch(200, { id: 1, email: credentials.email });

    await expect(auth[method](credentials)).resolves.toEqual({ id: 1, email: credentials.email });

    expect(fetchMock).toHaveBeenCalledWith(url, {
      method: "POST",
      body: JSON.stringify(credentials),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("signout posts to /api/auth/signout", async () => {
    const fetchMock = mockFetch(200, null);
    await auth.signout();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signout");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("me gets /api/auth/me", async () => {
    const fetchMock = mockFetch(200, { id: 1, email: credentials.email });
    await auth.me();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it("throws an ApiError with the status and FastAPI detail on failure", async () => {
    mockFetch(501, { detail: "Accounts are not available yet." });

    const error = await auth.signin(credentials).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 501, message: "Accounts are not available yet." });
  });

  it.each([
    ["a validation error list", 422, { detail: [{ msg: "Field required" }] }, "Unprocessable Entity", "Unprocessable Entity"],
    ["a non-JSON error page", 502, "<html>Bad Gateway</html>", "Bad Gateway", "Bad Gateway"],
    ["an empty error body without status text", 500, "", "", "Request failed (500)"],
  ])("falls back to the status text for %s", async (_, status, body, statusText, message) => {
    mockFetch(status, body, statusText);

    const error = await auth.signin(credentials).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, message });
  });
});
