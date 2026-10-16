import { expect, test } from "@playwright/test";

for (const { mode, title, heading, button, link } of [
  { mode: "signin", title: "Sign in | Prelegal", heading: "Sign in to Prelegal", button: "Sign in", link: "Sign up" },
  { mode: "signup", title: "Sign up | Prelegal", heading: "Create your Prelegal account", button: "Sign up", link: "Sign in" },
]) {
  test(`/${mode}/ submits to the placeholder auth API and shows its message`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`/${mode}/`);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();

    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("secret");
    const [response] = await Promise.all([
      page.waitForResponse(`**/api/auth/${mode}`),
      page.getByRole("button", { name: button }).click(),
    ]);

    expect(response.status()).toBe(501);
    // Scoped to main: Next.js adds its own role="alert" route announcer.
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Accounts are not available yet.");
    await expect(page.getByRole("link", { name: link })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("links between the sign-in and sign-up pages", async ({ page }) => {
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/signin\/$/);
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/signin\/$/);
});

test("the backend health check responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ status: "ok" });
});
