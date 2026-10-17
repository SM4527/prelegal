import { describe, expect, it } from "vitest";
import { buildDocumentMarkdown, type DocumentFields, type DocumentInfo } from "./documents";
import { buildNdaMarkdown, defaultFormData, escapeMarkdown as esc } from "./nda";
import { loadDocuments, loadNdaTemplates } from "./templates";

const documents = loadDocuments();
const generic = Object.values(documents).filter((doc) => !doc.coverPage);
const emptyParty = { name: "", title: "", company: "", noticeAddress: "" };

function blankFields(doc: DocumentInfo, overrides: Record<string, unknown> = {}): DocumentFields {
  return {
    party1: emptyParty,
    party2: emptyParty,
    ...Object.fromEntries(doc.fields.map((f) => [f.key, ""])),
    ...overrides,
  };
}

/** The markdown table row whose first cell is `label`. */
function row(markdown: string, label: string): string | undefined {
  return markdown.split("\n").find((line) => line.startsWith(`| ${esc(label)} |`));
}

describe("loadDocuments", () => {
  it("loads every supported document with its catalog name, template and PDF file name", () => {
    expect(Object.keys(documents)).toHaveLength(11);
    expect(documents.csa).toMatchObject({
      name: "Cloud Service Agreement",
      parties: ["Provider", "Customer"],
      filename: "CSA.pdf",
      coverPage: null,
    });
    expect(documents.csa.standardTerms).toMatch(/^# Cloud Service Agreement\n/);
    expect(documents["mutual-nda"]).toMatchObject({ name: "Mutual Non-Disclosure Agreement", filename: "Mutual-NDA.pdf" });
    expect(documents["mutual-nda"].coverPage).toContain("USING THIS MUTUAL NON-DISCLOSURE AGREEMENT");
  });

  it("normalises Windows line endings", () => {
    for (const doc of Object.values(documents)) {
      expect(doc.standardTerms).not.toContain("\r");
    }
  });
});

describe("buildDocumentMarkdown", () => {
  it.each(generic.map((doc) => [doc.id, doc]))("builds %s: a Cover Page, then its Standard Terms without markup", (_, doc) => {
    const markdown = buildDocumentMarkdown(doc, blankFields(doc), "2026-10-13");

    expect(markdown.startsWith(`# ${doc.name} Cover Page\n`)).toBe(true);
    expect(markdown).toContain(`\n# ${doc.name}\n`);
    expect(markdown).toContain(`\n| | ${esc(doc.parties[0])} | ${esc(doc.parties[1])} |\n`);
    for (const field of doc.fields) {
      expect(row(markdown, field.label)).toBe(`| ${esc(field.label)} | ${esc(`[${field.label}]`)} |`);
    }
    expect(markdown).not.toContain("<span");
  });

  it("fills in the key terms and both parties, and shows N/A as given", () => {
    const markdown = buildDocumentMarkdown(
      documents.csa,
      blankFields(documents.csa, {
        fees: "$2,000 per month",
        technicalSupport: "N/A",
        party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "ada@acme.test" },
        party2: { ...emptyParty, company: "Globex LLC" },
      }),
      "2026-10-13",
    );

    expect(row(markdown, "Fees")).toBe(`| Fees | ${esc("$2,000 per month")} |`);
    expect(row(markdown, "Technical Support")).toBe(`| Technical Support | ${esc("N/A")} |`);
    expect(row(markdown, "Company")).toBe("| Company | Acme Inc | Globex LLC |");
    expect(row(markdown, "Print Name")).toBe(`| Print Name | Ada Lovelace | ${esc("[Print Name]")} |`);
    expect(row(markdown, "Signature")).toBe("| Signature | | |");
  });

  it("escapes values so they can't inject markdown or break the table", () => {
    const hostile = "*Acme* | <b>x</b> [link](javascript:alert(1))\nsecond line";
    const markdown = buildDocumentMarkdown(documents.pilot, blankFields(documents.pilot, { product: hostile }), "2026-10-13");

    expect(row(markdown, "Product")).toBe(`| Product | ${esc("*Acme* | <b>x</b> [link](javascript:alert(1)) second line")} |`);
    expect(row(markdown, "Product")).toContain("\\|");
  });

  it("uses the official Cover Page for the Mutual NDA, falling back to today for the date", () => {
    const fields = { ...defaultFormData, governingLaw: "Delaware" } as unknown as DocumentFields;
    expect(buildDocumentMarkdown(documents["mutual-nda"], fields, "2026-10-13")).toBe(
      buildNdaMarkdown(loadNdaTemplates(), { ...defaultFormData, governingLaw: "Delaware", effectiveDate: "2026-10-13" }),
    );
  });
});
