/**
 * Mutual NDA document model and template filling.
 *
 * The Common Paper Mutual NDA is two markdown files: a Cover Page holding
 * the deal-specific values, and Standard Terms that refer to those values by
 * name. Filling the NDA therefore only touches the Cover Page; the Standard
 * Terms are appended unchanged apart from stripping their HTML markup.
 */

export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface NdaFormData {
  purpose: string;
  /** ISO date (yyyy-mm-dd), or empty when not yet chosen. */
  effectiveDate: string;
  mndaTerm: { type: "expires"; years: number } | { type: "continues" };
  confidentialityTerm: { type: "years"; years: number } | { type: "perpetual" };
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
}

export interface NdaTemplates {
  coverPage: string;
  standardTerms: string;
}

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

export const defaultFormData: NdaFormData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTerm: { type: "expires", years: 1 },
  confidentialityTerm: { type: "years", years: 1 },
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

/** Returns today's date in the local timezone as yyyy-mm-dd. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Formats yyyy-mm-dd as e.g. "October 13, 2026" without timezone shifts. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Backslash-escapes every ASCII punctuation character so user input renders
 * literally and cannot inject markdown (links, emphasis, table pipes, HTML).
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

/** Escapes a value for an inline position, falling back to a bracketed placeholder. */
function inline(value: string, placeholder: string): string {
  const text = value.trim().replace(/\s*\n\s*/g, " ");
  return escapeMarkdown(text || `[${placeholder}]`);
}

/** Escapes a value that may span several lines, keeping its line breaks. */
function multiline(value: string, placeholder: string): string {
  const lines = value.trim().split(/\r?\n/).map((line) => escapeMarkdown(line.trim()));
  return lines.join("\\\n") || escapeMarkdown(`[${placeholder}]`);
}

function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

function checkbox(checked: boolean): string {
  return checked ? "- [x]" : "- [ ]";
}

/**
 * Removes the template's HTML markup: `<span class="...">Term</span>` becomes
 * `Term`, and form-hint `<label>` elements are dropped.
 */
export function stripTemplateHtml(markdown: string): string {
  return markdown
    .replace(/<span[^>]*>(.*?)<\/span>/g, "$1")
    .replace(/[ \t]*<label>.*?<\/label>[ \t]*/g, "");
}

/** Replaces exactly one occurrence, failing loudly if the template has drifted. */
function replaceOnce(source: string, search: string, replacement: string): string {
  const index = source.indexOf(search);
  if (index === -1) {
    throw new Error(`Mutual NDA template is missing expected text: ${search}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

/** Fills the Cover Page template with the user's values. */
export function fillCoverPage(template: string, data: NdaFormData): string {
  const { mndaTerm, confidentialityTerm, party1, party2 } = data;
  const row = (label: string, a: string, b: string) => `| ${label} | ${a} | ${b} |`;
  const partyRow = (label: string, field: keyof Party) =>
    row(label, inline(party1[field], label), inline(party2[field], label));

  const replacements: [string, string][] = [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      multiline(data.purpose, "Purpose"),
    ],
    ["[Today’s date]", inline(formatDate(data.effectiveDate), "Effective Date")],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${checkbox(mndaTerm.type === "expires")} Expires ${
        mndaTerm.type === "expires" ? years(mndaTerm.years) : "\\[N years\\]"
      } from Effective Date.`,
    ],
    [
      "- [ ]     Continues until terminated",
      `${checkbox(mndaTerm.type === "continues")} Continues until terminated`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but",
      `${checkbox(confidentialityTerm.type === "years")} ${
        confidentialityTerm.type === "years" ? years(confidentialityTerm.years) : "\\[N years\\]"
      } from Effective Date, but`,
    ],
    [
      "- [ ]     In perpetuity.",
      `${checkbox(confidentialityTerm.type === "perpetual")} In perpetuity.`,
    ],
    ["Governing Law: [Fill in state]", `Governing Law: ${inline(data.governingLaw, "Governing Law")}`],
    [
      "Jurisdiction: [Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      `Jurisdiction: ${inline(data.jurisdiction, "Jurisdiction")}`,
    ],
    ["List any modifications to the MNDA", data.modifications.trim() ? multiline(data.modifications, "") : "None."],
    ["| Print Name | |", partyRow("Print Name", "name")],
    ["| Title | | |", partyRow("Title", "title")],
    ["| Company | | |", partyRow("Company", "company")],
    ["| Notice Address <label>Use either email or postal address</label> | | |", partyRow("Notice Address", "noticeAddress")],
  ];

  const filled = replacements.reduce(
    (markdown, [search, replacement]) => replaceOnce(markdown, search, replacement),
    template,
  );
  return stripTemplateHtml(filled);
}

/** Builds the complete Mutual NDA (filled Cover Page followed by Standard Terms) as markdown. */
export function buildNdaMarkdown(templates: NdaTemplates, data: NdaFormData): string {
  return `${fillCoverPage(templates.coverPage, data).trim()}\n\n${stripTemplateHtml(templates.standardTerms).trim()}\n`;
}
