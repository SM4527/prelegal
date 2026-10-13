import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";

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

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("loads the creator with the full agreement and no errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();

  await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
  await expect(page.getByRole("heading", { level: 1, name: "Mutual NDA Creator" })).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "Mutual Non-Disclosure Agreement", exact: true })).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "Standard Terms" })).toBeAttached();
  await expect(preview(page)).toContainText("Governing Law: [Governing Law]");
  expect(errors).toEqual([]);
});

test("fills in today's date in the browser", async ({ page }) => {
  const today = await page.evaluate(() =>
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  );
  await expect(preview(page)).toContainText(today);
  await expect(page.getByLabel("Effective date")).toHaveValue("");
});

test("completes an NDA and downloads it as a PDF with the entered details", async ({ page }) => {
  const errors = trackErrors(page);

  await page.getByLabel("Purpose").fill("Evaluating a potential acquisition.");
  await page.getByLabel("Effective date").fill("2026-12-01");
  await page.getByRole("combobox", { name: "MNDA term in years" }).selectOption("3");
  await page.getByRole("radio", { name: "In perpetuity" }).check();
  await page.getByLabel("Governing law").fill("California");
  await page.getByLabel("Jurisdiction").fill("courts located in San Francisco, CA");
  await page.getByLabel("Modifications").fill("Section 6 retention limited to 30 days.");
  const parties = [
    { company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", address: "ada@acme.test" },
    { company: "Globex LLC", name: "Alan Turing", title: "CTO", address: "alan@globex.test" },
  ];
  for (const [i, party] of parties.entries()) {
    await page.getByLabel("Company").nth(i).fill(party.company);
    await page.getByLabel("Signer name").nth(i).fill(party.name);
    await page.getByLabel("Title").nth(i).fill(party.title);
    await page.getByLabel("Notice address").nth(i).fill(party.address);
  }

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

test("downloads repeatedly, reflecting edits made between downloads", async ({ page }) => {
  await page.getByLabel("Governing law").fill("Delaware");
  expect((await downloadPdf(page)).text).toContain("Governing Law: Delaware");

  await page.getByLabel("Governing law").fill("New York");
  expect((await downloadPdf(page)).text).toContain("Governing Law: New York");
});

test("loads the PDF library only when downloading", async ({ page }) => {
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

test("can be completed with the keyboard alone", async ({ page }) => {
  await page.getByLabel("Governing law").focus();
  await page.keyboard.type("Delaware");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Jurisdiction")).toBeFocused();

  await page.getByRole("radio", { name: "Expires after" }).focus();
  await page.keyboard.press("ArrowDown"); // radios in a group move with arrow keys
  await expect(page.getByRole("radio", { name: "Continues until terminated" })).toBeChecked();
  await expect(preview(page).locator("li", { hasText: "Continues until terminated" }).getByRole("checkbox")).toBeChecked();

  const download = page.getByRole("button", { name: "Download PDF" });
  await download.focus();
  const [file] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(file.suggestedFilename()).toBe("Mutual-NDA.pdf");
  await expect(download).toBeFocused();
});

test("shows user input literally in the preview", async ({ page }) => {
  await page.getByLabel("Company").first().fill("*Acme* | <img src=x onerror=alert(1)> [x](javascript:alert(1))");
  await expect(preview(page)).toContainText("*Acme* | <img src=x onerror=alert(1)> [x](javascript:alert(1))");
  await expect(preview(page).locator("img, em, a[href^='javascript']")).toHaveCount(0);
});

test("fits the viewport without horizontal scrolling", async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
