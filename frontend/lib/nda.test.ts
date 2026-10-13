import { describe, expect, it } from "vitest";
import {
  buildNdaMarkdown,
  defaultFormData,
  escapeMarkdown,
  fillCoverPage,
  formatDate,
  type NdaFormData,
} from "./nda";
import { loadNdaTemplates } from "./templates";

// Uses the real templates so any upstream template change that breaks filling fails here.
const templates = loadNdaTemplates();

const filledData: NdaFormData = {
  ...defaultFormData,
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-10-13",
  mndaTerm: { type: "expires", years: 2 },
  confidentialityTerm: { type: "perpetual" },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
};

describe("fillCoverPage", () => {
  const cover = fillCoverPage(templates.coverPage, filledData);

  it("fills the key terms", () => {
    expect(cover).toContain("Exploring a joint venture\\.");
    expect(cover).toContain("October 13\\, 2026");
    expect(cover).toContain("Governing Law: Delaware");
    expect(cover).toContain("Jurisdiction: courts located in New Castle\\, DE");
    expect(cover).toContain("None.");
  });

  it("checks the selected term options only", () => {
    expect(cover).toContain("- [x] Expires 2 years from Effective Date.");
    expect(cover).toContain("- [ ] Continues until terminated");
    expect(cover).toMatch(/- \[ \] \\\[N years\\\] from Effective Date, but/);
    expect(cover).toContain("- [x] In perpetuity.");
  });

  it("fills both parties into the signature table, leaving signature and date blank", () => {
    expect(cover).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(cover).toContain("| Title | CEO | CTO |");
    expect(cover).toContain("| Company | Acme Inc\\. | Globex LLC |");
    expect(cover).toContain("| Notice Address | ada\\@acme\\.test | alan\\@globex\\.test |");
    expect(cover).toContain("| Signature | | |");
    expect(cover).toContain("| Date | | |");
  });

  it("leaves no template placeholders or HTML behind", () => {
    expect(cover).not.toMatch(/\[(Today|Fill in|1 year|Evaluating)/);
    expect(cover).not.toMatch(/<\/?(span|label)/);
  });

  it("shows bracketed placeholders for empty fields", () => {
    const blank = fillCoverPage(templates.coverPage, defaultFormData);
    expect(blank).toContain("\\[Effective Date\\]");
    expect(blank).toContain("Governing Law: \\[Governing Law\\]");
    expect(blank).toContain("| Print Name | \\[Print Name\\] | \\[Print Name\\] |");
  });

  it("uses singular year and keeps multi-line modifications", () => {
    const cover = fillCoverPage(templates.coverPage, {
      ...filledData,
      mndaTerm: { type: "expires", years: 1 },
      modifications: "First change\nSecond change",
    });
    expect(cover).toContain("Expires 1 year from Effective Date.");
    expect(cover).toContain("First change\\\nSecond change");
  });

  it("throws when the template no longer matches", () => {
    expect(() => fillCoverPage("# Something else", filledData)).toThrow(/missing expected text/);
  });
});

describe("escapeMarkdown", () => {
  it("neutralises markdown and HTML in user input", () => {
    expect(escapeMarkdown("*bold* | [x](y) <b>")).toBe("\\*bold\\* \\| \\[x\\]\\(y\\) \\<b\\>");
  });

  it("keeps table pipes in party fields from breaking the table", () => {
    const cover = fillCoverPage(templates.coverPage, {
      ...filledData,
      party1: { ...filledData.party1, company: "A | B" },
    });
    expect(cover).toContain("| Company | A \\| B | Globex LLC |");
  });
});

describe("formatDate", () => {
  it("formats ISO dates without timezone shifts", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
  });
});

describe("buildNdaMarkdown", () => {
  it("appends the Standard Terms with markup stripped", () => {
    const md = buildNdaMarkdown(templates, filledData);
    expect(md.indexOf("# Mutual Non-Disclosure Agreement")).toBeLessThan(md.indexOf("# Standard Terms"));
    expect(md).toContain("solely for the Purpose;");
    expect(md).not.toContain("<span");
  });
});
