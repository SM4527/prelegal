import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/disclaimer";
import { buildDocumentMarkdown, type DocumentFields } from "@/lib/documents";
import { buildNdaMarkdown, defaultFormData, type NdaFormData } from "@/lib/nda";
import { loadDocuments, loadNdaTemplates } from "@/lib/templates";
import { DocumentPdf } from "./DocumentPdf";

const templates = loadNdaTemplates();
const documents = loadDocuments();

/** Renders markdown as a PDF and returns the text of each page and the document title. */
async function renderPdf(markdown: string, title = "Mutual Non-Disclosure Agreement") {
  const buffer = await renderToBuffer(<DocumentPdf markdown={markdown} title={title} />);
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: false });
  const { info } = (await pdf.getMetadata()) as unknown as { info: { Title: string } };
  return { pages: text, title: info.Title };
}

/** Renders the NDA for the given form data and returns the text of each PDF page. */
async function renderPages(overrides: Partial<NdaFormData> = {}): Promise<string[]> {
  return (await renderPdf(buildNdaMarkdown(templates, { ...defaultFormData, effectiveDate: "2026-10-13", ...overrides }))).pages;
}

const squash = (text: string) => text.replace(/\s+/g, " ");

describe("DocumentPdf", () => {
  it("puts the draft disclaimer at the foot of every page", async () => {
    const pages = await renderPages();
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(squash(page)).toContain(DISCLAIMER);
  });

  it("renders a generated Cover Page with its tables, then the Standard Terms on a new page, under the given title", async () => {
    const fields: DocumentFields = {
      party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
      party2: { name: "", title: "", company: "Globex LLC", noticeAddress: "" },
      ...Object.fromEntries(documents.csa.fields.map((f) => [f.key, ""])),
      fees: "$2,000 per month",
      technicalSupport: "N/A",
    };
    const { pages, title } = await renderPdf(buildDocumentMarkdown(documents.csa, fields, "2026-10-13"), "Cloud Service Agreement");

    expect(title).toBe("Cloud Service Agreement");
    const cover = squash(pages[0]);
    expect(cover).toMatch(/^Cloud Service Agreement Cover Page/);
    expect(cover).toContain("Fees $2,000 per month");
    expect(cover).toContain("Technical Support N/A");
    expect(cover).toContain("Subscription Period [Subscription Period]");
    expect(cover).toContain("Provider Customer");
    expect(cover).toContain("Company Acme Inc. Globex LLC");
    const termsPage = pages.findIndex((page) => squash(page).startsWith("Cloud Service Agreement 1."));
    expect(termsPage).toBeGreaterThan(0);
  });

  it("keeps the DPA's deeply indented clauses, which parse as a code block", async () => {
    const fields: DocumentFields = {
      party1: { name: "", title: "", company: "", noticeAddress: "" },
      party2: { name: "", title: "", company: "", noticeAddress: "" },
      ...Object.fromEntries(documents.dpa.fields.map((f) => [f.key, ""])),
    };
    const { pages } = await renderPdf(buildDocumentMarkdown(documents.dpa, fields, "2026-10-13"), "Data Processing Agreement");

    const all = squash(pages.join(" "));
    expect(all).toContain("i. The optional docking clause in Clause 7 does not apply;");
    expect(all).toContain("ii. In Clause 9, Option 2 (general written authorization) applies");
  });

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
