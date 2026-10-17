import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { buildNdaMarkdown, defaultFormData, type NdaFormData } from "@/lib/nda";
import { loadNdaTemplates } from "@/lib/templates";
import { DocumentPdf } from "./DocumentPdf";

const templates = loadNdaTemplates();

/** Renders the NDA for the given form data and returns the text of each PDF page. */
async function renderPages(overrides: Partial<NdaFormData> = {}): Promise<string[]> {
  const markdown = buildNdaMarkdown(templates, { ...defaultFormData, effectiveDate: "2026-10-13", ...overrides });
  const buffer = await renderToBuffer(<DocumentPdf markdown={markdown} />);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: false });
  return text;
}

const squash = (text: string) => text.replace(/\s+/g, " ");

describe("DocumentPdf", () => {
  it("renders the filled Cover Page and the Standard Terms on a new page", async () => {
    const pages = await renderPages({
      purpose: "Exploring a joint venture.",
      mndaTerm: { fixed: true, years: 2 },
      confidentialityTerm: { fixed: false, years: 1 },
      governingLaw: "Delaware",
      jurisdiction: "courts located in New Castle, DE",
      modifications: "Section 6 retention limited to 30 days.",
      party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
      party2: { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
    });
    const all = squash(pages.join(" "));

    expect(squash(pages[0])).toMatch(/^Mutual Non-Disclosure Agreement USING THIS MUTUAL NON-DISCLOSURE AGREEMENT/);
    expect(all).toContain("Purpose Exploring a joint venture.");
    expect(all).toContain("Effective Date October 13, 2026");
    expect(all).toContain("[X] Expires 2 years from Effective Date.");
    expect(all).toContain("[ ] Continues until terminated");
    expect(all).toContain("[ ] [N years] from Effective Date, but");
    expect(all).toContain("[X] In perpetuity.");
    expect(all).toContain("Governing Law: Delaware");
    expect(all).toContain("Jurisdiction: courts located in New Castle, DE");
    expect(all).toContain("MNDA Modifications Section 6 retention limited to 30 days.");
    expect(all).toContain("Print Name Ada Lovelace Alan Turing");
    expect(all).toContain("Company Acme Inc. Globex LLC");
    expect(all).toContain("Notice Address ada@acme.test alan@globex.test");

    const termsPage = pages.findIndex((page) => page.startsWith("Standard Terms"));
    expect(termsPage).toBeGreaterThan(0);
    expect(pages.slice(0, termsPage).join(" ")).not.toContain("Introduction.");
  });

  it("numbers all eleven Standard Terms sections in order", async () => {
    const all = squash((await renderPages()).join(" "));
    const sections = [
      "Introduction", "Use and Protection of Confidential Information", "Exceptions",
      "Disclosures Required by Law", "Term and Termination", "Return or Destruction of Confidential Information",
      "Proprietary Rights", "Disclaimer", "Governing Law and Jurisdiction", "Equitable Relief", "General",
    ];
    let position = 0;
    sections.forEach((section, i) => {
      const index = all.indexOf(`${i + 1}. ${section}.`, position);
      expect(index, `section ${i + 1}. ${section}`).toBeGreaterThanOrEqual(position);
      position = index;
    });
  });

  it("shows placeholders for missing values and leaves signature lines blank", async () => {
    const all = squash((await renderPages()).join(" "));
    expect(all).toContain("Governing Law: [Governing Law]");
    expect(all).toContain("Print Name [Print Name] [Print Name]");
    expect(all).toMatch(/Signature Print Name/);
    expect(all).toMatch(/Date Common Paper Mutual Non-Disclosure Agreement \(Version 1\.0\)/);
  });

  it("prints user input literally", async () => {
    const all = squash(
      (await renderPages({ party1: { ...defaultFormData.party1, company: "*Acme* | <b>Ltd</b> [x](y)" } })).join(" "),
    );
    expect(all).toContain("Company *Acme* | <b>Ltd</b> [x](y) [Company]");
  });

  it("keeps line breaks from multi-line fields", async () => {
    const pages = await renderPages({ modifications: "First change\nSecond change" });
    expect(pages.join("\n")).toMatch(/First change\s*\n\s*Second change/);
  });

  it("handles very long input without failing", async () => {
    const long = "Confidential project details. ".repeat(200);
    const pages = await renderPages({ purpose: long, modifications: long });
    expect(pages.length).toBeGreaterThan(4);
  });
});
