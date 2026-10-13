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

/**
 * A term that lasts a fixed number of years, or is open-ended ("continues until
 * terminated" for the MNDA term, "in perpetuity" for confidentiality). `years` is
 * kept while open-ended so switching back restores the user's choice.
 */
export interface Term {
  fixed: boolean;
  years: number;
}

export interface NdaFormData {
  purpose: string;
  /** ISO date (yyyy-mm-dd), or empty when not chosen (the UI then uses today). */
  effectiveDate: string;
  mndaTerm: Term;
  confidentialityTerm: Term;
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
  mndaTerm: { fixed: true, years: 1 },
  confidentialityTerm: { fixed: true, years: 1 },
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: { ...emptyParty },
  party2: { ...emptyParty },
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

/** Escapes a single-line value (newlines become spaces), or the fallback when empty. */
function inline(value: string, fallback: string): string {
  const text = value.trim().replace(/\s*\n\s*/g, " ");
  return escapeMarkdown(text || fallback);
}

/** Escapes a value that may span several lines, keeping its line breaks, or the fallback when empty. */
function multiline(value: string, fallback: string): string {
  const text = value.trim();
  if (!text) return escapeMarkdown(fallback);
  return text
    .split(/\r?\n/)
    .map((line) => escapeMarkdown(line.trim()))
    .join("\\\n");
}

function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

/** A term's length for the cover page: "2 years", or a blank when it isn't a fixed term. */
function termYears(term: Term): string {
  return term.fixed ? years(term.years) : escapeMarkdown("[N years]");
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

/**
 * Replaces the first occurrence of each search string in one pass. Every search
 * runs against the original template, so user text inserted by one replacement
 * can never be matched by another. Fails loudly if the template has drifted.
 */
function replaceInTemplate(template: string, replacements: [search: string, replacement: string][]): string {
  const hits = replacements
    .map(([search, replacement]) => {
      const start = template.indexOf(search);
      if (start === -1) throw new Error(`Mutual NDA template is missing expected text: ${search}`);
      return { start, end: start + search.length, replacement };
    })
    .sort((a, b) => a.start - b.start);

  let result = "";
  let position = 0;
  for (const { start, end, replacement } of hits) {
    result += template.slice(position, start) + replacement;
    position = end;
  }
  return result + template.slice(position);
}

/** Fills the Cover Page template with the user's values. */
export function fillCoverPage(template: string, data: NdaFormData): string {
  const { mndaTerm, confidentialityTerm, party1, party2 } = data;
  const partyRow = (label: string, field: keyof Party) =>
    `| ${label} | ${inline(party1[field], `[${label}]`)} | ${inline(party2[field], `[${label}]`)} |`;

  const filled = replaceInTemplate(template, [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      multiline(data.purpose, "[Purpose]"),
    ],
    ["[Today’s date]", inline(formatDate(data.effectiveDate), "[Effective Date]")],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.",
      `${checkbox(mndaTerm.fixed)} Expires ${termYears(mndaTerm)} from Effective Date.`,
    ],
    ["- [ ]     Continues until terminated", `${checkbox(!mndaTerm.fixed)} Continues until terminated`],
    [
      "- [x]     [1 year(s)] from Effective Date, but",
      `${checkbox(confidentialityTerm.fixed)} ${termYears(confidentialityTerm)} from Effective Date, but`,
    ],
    ["- [ ]     In perpetuity.", `${checkbox(!confidentialityTerm.fixed)} In perpetuity.`],
    ["Governing Law: [Fill in state]", `Governing Law: ${inline(data.governingLaw, "[Governing Law]")}`],
    [
      "Jurisdiction: [Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      `Jurisdiction: ${inline(data.jurisdiction, "[Jurisdiction]")}`,
    ],
    ["List any modifications to the MNDA", multiline(data.modifications, "None.")],
    ["| Print Name | |", partyRow("Print Name", "name")],
    ["| Title | | |", partyRow("Title", "title")],
    ["| Company | | |", partyRow("Company", "company")],
    ["| Notice Address <label>Use either email or postal address</label> | | |", partyRow("Notice Address", "noticeAddress")],
  ]);
  return stripTemplateHtml(filled);
}

/** Builds the complete Mutual NDA (filled Cover Page followed by Standard Terms) as markdown. */
export function buildNdaMarkdown(templates: NdaTemplates, data: NdaFormData): string {
  return `${fillCoverPage(templates.coverPage, data).trim()}\n\n${stripTemplateHtml(templates.standardTerms).trim()}\n`;
}
