import { buildNdaMarkdown, escapeMarkdown, inline, stripTemplateHtml, type NdaFormData, type Party } from "./nda";

export interface FieldDef {
  key: string;
  label: string;
  description: string;
}

/** A supported document, from documents.json and catalog.json, with its template text. */
export interface DocumentInfo {
  id: string;
  name: string;
  /** Labels for party1 and party2, e.g. Provider and Customer. */
  parties: [string, string];
  /** The key terms on the generated Cover Page (empty for documents with their own cover page). */
  fields: FieldDef[];
  standardTerms: string;
  /** The document's own cover page template, if it has one (the Mutual NDA). */
  coverPage: string | null;
  filename: string;
}

/** The fields the assistant has filled in: both parties plus the document's key terms. */
export type DocumentFields = { party1: Party; party2: Party } & Record<string, unknown>;

const PARTY_ROWS: [label: string, key: keyof Party][] = [
  ["Print Name", "name"],
  ["Title", "title"],
  ["Company", "company"],
  ["Notice Address", "noticeAddress"],
];

/** A Cover Page with the key terms and a signature table, for documents that ship only Standard Terms. */
function coverPage(doc: DocumentInfo, fields: DocumentFields): string {
  const [first, second] = doc.parties.map(escapeMarkdown);
  const terms = doc.fields.map(
    ({ key, label }) => `| ${escapeMarkdown(label)} | ${inline(String(fields[key] ?? ""), `[${label}]`)} |`,
  );
  const parties = PARTY_ROWS.map(
    ([label, key]) => `| ${label} | ${inline(fields.party1[key], `[${label}]`)} | ${inline(fields.party2[key], `[${label}]`)} |`,
  );
  return [
    `# ${doc.name} Cover Page`,
    `This Cover Page sets out the key terms of the ${doc.name} between the parties below. ` +
      "It incorporates the Standard Terms that follow, which apply as written except as stated here.",
    ["## Key Terms", "| Key Term | Detail |", "| --- | --- |", ...terms].join("\n"),
    ["## Signatures", `| | ${first} | ${second} |`, "| --- | --- | --- |", "| Signature | | |", ...parties, "| Date | | |"].join("\n"),
  ].join("\n\n");
}

/** The complete document: its cover page followed by the Standard Terms. Blank values show as placeholders. */
export function buildDocumentMarkdown(doc: DocumentInfo, fields: DocumentFields, today: string): string {
  if (doc.coverPage) {
    const nda = fields as unknown as NdaFormData;
    // The fields keep the (possibly blank) chosen date; the document falls back to today.
    return buildNdaMarkdown(
      { coverPage: doc.coverPage, standardTerms: doc.standardTerms },
      { ...nda, effectiveDate: nda.effectiveDate || today },
    );
  }
  return `${coverPage(doc, fields)}\n\n${stripTemplateHtml(doc.standardTerms).trim()}\n`;
}
