import { expect, test, type Page } from "@playwright/test";
import { GREETING, stubChat } from "./chat-stub";

// These use the real auth API; the chat API is stubbed so no LLM is called.
const PASSWORD = "correct horse battery";

/** An email no other test (or browser project, sharing the backend) has used. */
const uniqueEmail = () => `user-${test.info().project.name}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const header = (page: Page) => page.getByRole("banner").first();
const chatLog = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function submitAuth(page: Page, mode: "signin" | "signup", email: string, password = PASSWORD) {
  await page.goto(`/${mode}/`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("main").getByRole("button", { name: mode === "signin" ? "Sign in" : "Sign up" }).click();
}

for (const { mode, title, heading, link } of [
  { mode: "signin", title: "Sign in | Prelegal", heading: "Sign in to Prelegal", link: "Sign up" },
  { mode: "signup", title: "Sign up | Prelegal", heading: "Create your Prelegal account", link: "Sign in" },
]) {
  test(`/${mode}/ shows its form`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`/${mode}/`);

    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: link })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("signs up, signs out and signs back in", async ({ page }) => {
  await stubChat(page);
  const email = uniqueEmail();

  await submitAuth(page, "signup", email);
  await expect(page).toHaveURL(/\/$/);
  await expect(header(page)).toContainText(email);
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
  await expect(page.getByRole("link", { name: "create an account" })).toHaveCount(0);

  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page)).not.toContainText(email);

  await submitAuth(page, "signin", email.toUpperCase());
  await expect(header(page)).toContainText(email);
});

test("shows why signing in or up failed", async ({ page }) => {
  await stubChat(page);
  const email = uniqueEmail();
  await submitAuth(page, "signup", email);
  await expect(header(page)).toContainText(email);
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();

  // Scoped to main: Next.js adds its own role="alert" route announcer.
  await submitAuth(page, "signin", email, "wrong password");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");

  await submitAuth(page, "signup", email);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("An account with that email already exists.");
});

test("works without an account, suggesting one to save the document", async ({ page }) => {
  await stubChat(page);
  await page.goto("/");
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
  await expect(page.getByRole("link", { name: "create an account" })).toHaveAttribute("href", "/signup/");
  await expect(header(page).getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("My documents asks a signed-out visitor to sign in", async ({ page }) => {
  await page.goto("/documents/");
  await expect(page).toHaveTitle("My documents | Prelegal");
  await expect(page.getByText("Sign in to see your documents")).toBeVisible();
});

test("My documents lists the user's documents and reopens one", async ({ page }) => {
  await stubChat(page);
  await submitAuth(page, "signup", uniqueEmail());
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
  await page.getByRole("button", { name: "New document" }).click();
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My documents" }).click();
  const cards = page.getByRole("list", { name: "Documents" }).getByRole("link");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute("href", "/?c=c2");

  await cards.last().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(chatLog(page).getByText(GREETING)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("prelegal.conversationId"))).toBe("c1");
});

test("links between the sign-in and sign-up pages", async ({ page }) => {
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/signin\/$/);
  await page.getByRole("main").getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/signin\/$/);
});

test("the backend health check responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});
