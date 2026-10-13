import { describe, expect, it } from "vitest";
import {
  buildNdaMarkdown,
  defaultFormData,
  escapeMarkdown,
  fillCoverPage,
  formatDate,
  stripTemplateHtml,
  todayIso,
  type NdaFormData,
} from "./nda";
import { loadNdaTemplates } from "./templates";

// Uses the real templates so any upstream template change that breaks filling fails here.
const templates = loadNdaTemplates();

const filledData: NdaFormData = {
  ...defaultFormData,
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-10-13",
  mndaTerm: { fixed: true, years: 2 },
  confidentialityTerm: { fixed: false, years: 3 },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "alan@globex.test" },
};

const fill = (overrides: Partial<NdaFormData> = {}) =>
  fillCoverPage(templates.coverPage, { ...filledData, ...overrides });

describe("loadNdaTemplates", () => {
  it("loads both Mutual NDA templates", () => {
    expect(templates.coverPage).toMatch(/^# Mutual Non-Disclosure Agreement/);
    expect(templates.standardTerms).toMatch(/^# Standard Terms/);
  });
});

describe("fillCoverPage", () => {
  const cover = fill();

  it("fills the key terms", () => {
    expect(cover).toContain("Exploring a joint venture\\.");
    expect(cover).toContain("October 13\\, 2026");
    expect(cover).toContain("Governing Law: Delaware");
    expect(cover).toContain("Jurisdiction: courts located in New Castle\\, DE");
    expect(cover).toContain("None\\.");
  });

  it("checks the selected term options only", () => {
    expect(cover).toContain("- [x] Expires 2 years from Effective Date.");
    expect(cover).toContain("- [ ] Continues until terminated");
    expect(cover).toContain("- [ ] \\[N years\\] from Effective Date, but");
    expect(cover).toContain("- [x] In perpetuity.");
  });

  it.each([
    [{ fixed: true, years: 1 }, "- [x] Expires 1 year from Effective Date.", "- [ ] Continues"],
    [{ fixed: true, years: 10 }, "- [x] Expires 10 years from Effective Date.", "- [ ] Continues"],
    [{ fixed: false, years: 4 }, "- [ ] Expires \\[N years\\] from Effective Date.", "- [x] Continues"],
  ])("renders MNDA term %o", (mndaTerm, expires, continues) => {
    const result = fill({ mndaTerm });
    expect(result).toContain(expires);
    expect(result).toContain(continues);
  });

  it.each([
    [{ fixed: true, years: 1 }, "- [x] 1 year from Effective Date, but", "- [ ] In perpetuity."],
    [{ fixed: true, years: 7 }, "- [x] 7 years from Effective Date, but", "- [ ] In perpetuity."],
    [{ fixed: false, years: 7 }, "- [ ] \\[N years\\] from Effective Date, but", "- [x] In perpetuity."],
  ])("renders confidentiality term %o", (confidentialityTerm, years, perpetual) => {
    const result = fill({ confidentialityTerm });
    expect(result).toContain(years);
    expect(result).toContain(perpetual);
  });

  it("fills both parties into the signature table, leaving signature and date blank", () => {
    expect(cover).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(cover).toContain("| Title | CEO | CTO |");
    expect(cover).toContain("| Company | Acme Inc\\. | Globex LLC |");
    expect(cover).toContain("| Notice Address | ada\\@acme\\.test | alan\\@globex\\.test |");
    expect(cover).toContain("| Signature | | |");
    expect(cover).toContain("| Date | | |");
  });

  it("leaves no template placeholders, form hints or HTML behind", () => {
    expect(cover).not.toMatch(/\[(Today|Fill in|1 year|Evaluating)/);
    expect(cover).not.toContain("List any modifications");
    expect(cover).not.toContain("How Confidential Information may be used");
    expect(cover).not.toMatch(/<\/?(span|label)/);
  });

  it("keeps the rest of the template intact", () => {
    expect(cover).toMatch(/^# Mutual Non-Disclosure Agreement/);
    expect(cover).toContain("By signing this Cover Page, each party agrees to enter into this MNDA");
    expect(cover).toContain("free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)");
  });

  it("shows bracketed placeholders for empty fields", () => {
    const blank = fillCoverPage(templates.coverPage, defaultFormData);
    expect(blank).toContain("\\[Effective Date\\]");
    expect(blank).toContain("Governing Law: \\[Governing Law\\]");
    expect(blank).toContain("Jurisdiction: \\[Jurisdiction\\]");
    expect(blank).toContain("| Print Name | \\[Print Name\\] | \\[Print Name\\] |");
    expect(blank).toContain("| Notice Address | \\[Notice Address\\] | \\[Notice Address\\] |");
  });

  it("treats whitespace-only values as empty", () => {
    const result = fill({ purpose: "   \n  ", governingLaw: "  ", modifications: "\n\n" });
    expect(result).toContain("\\[Purpose\\]");
    expect(result).toContain("Governing Law: \\[Governing Law\\]");
    expect(result).toContain("None\\.");
  });

  it("keeps line breaks in multi-line fields, including Windows line endings", () => {
    const result = fill({ modifications: "First change\r\nSecond change\nThird" });
    expect(result).toContain("First change\\\nSecond change\\\nThird");
  });

  it("collapses line breaks in single-line fields so the table stays intact", () => {
    const result = fill({ party1: { ...filledData.party1, noticeAddress: "1 Main St\nSpringfield" } });
    expect(result).toContain("| Notice Address | 1 Main St Springfield | alan\\@globex\\.test |");
  });

  it("cannot be hijacked by user text that matches another template placeholder", () => {
    const result = fill({
      purpose: "List any modifications to the MNDA",
      governingLaw: "| Title | | |",
      modifications: "Real modification",
    });
    expect(result).toMatch(/### Purpose\s+List any modifications to the MNDA/);
    expect(result).toMatch(/### MNDA Modifications\s+Real modification/);
    expect(result).toContain("| Title | CEO | CTO |");
  });

  it("throws when the template no longer matches", () => {
    expect(() => fillCoverPage("# Something else", filledData)).toThrow(/missing expected text/);
  });
});

describe("escapeMarkdown", () => {
  it("escapes every ASCII punctuation character", () => {
    const punctuation = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    expect(escapeMarkdown(punctuation)).toBe([...punctuation].map((c) => `\\${c}`).join(""));
  });

  it("leaves letters, digits, spaces and non-ASCII characters alone", () => {
    expect(escapeMarkdown("Acme 42 Café “quoted” — ok")).toBe("Acme 42 Café “quoted” — ok");
  });

  it("neutralises markdown and HTML in user input", () => {
    expect(escapeMarkdown("*bold* | [x](y) <b>")).toBe("\\*bold\\* \\| \\[x\\]\\(y\\) \\<b\\>");
  });

  it("keeps table pipes in party fields from breaking the table", () => {
    expect(fill({ party1: { ...filledData.party1, company: "A | B" } })).toContain(
      "| Company | A \\| B | Globex LLC |",
    );
  });
});

describe("stripTemplateHtml", () => {
  it("unwraps spans and drops labels", () => {
    expect(stripTemplateHtml('the <span class="coverpage_link">Purpose</span> here')).toBe("the Purpose here");
    expect(stripTemplateHtml("### Purpose\n<label>hint</label>\nText")).toBe("### Purpose\n\nText");
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-01-01", "January 1, 2026"],
    ["2026-12-31", "December 31, 2026"],
    ["2028-02-29", "February 29, 2028"],
  ])("formats %s without timezone shifts", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  it.each(["", "2026", "not-a-date"])("returns empty for %j", (iso) => {
    expect(formatDate(iso)).toBe("");
  });
});

describe("todayIso", () => {
  it("uses the local date, zero-padded", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 10, 30, 0, 1))).toBe("2026-11-30");
  });
});

describe("buildNdaMarkdown", () => {
  const md = buildNdaMarkdown(templates, filledData);

  it("appends the Standard Terms after the Cover Page with markup stripped", () => {
    expect(md.indexOf("# Mutual Non-Disclosure Agreement")).toBeLessThan(md.indexOf("# Standard Terms"));
    expect(md).toContain("solely for the Purpose;");
    expect(md).not.toContain("<span");
  });

  it("includes all eleven Standard Terms sections", () => {
    for (const section of [
      "Introduction", "Use and Protection of Confidential Information", "Exceptions",
      "Disclosures Required by Law", "Term and Termination", "Return or Destruction of Confidential Information",
      "Proprietary Rights", "Disclaimer", "Governing Law and Jurisdiction", "Equitable Relief", "General",
    ]) {
      expect(md).toContain(`**${section}**.`);
    }
  });
});
