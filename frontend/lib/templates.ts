import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocumentInfo } from "./documents";
import type { NdaTemplates } from "./nda";

/**
 * Build-time readers for the repo-level registry (documents.json, catalog.json)
 * and templates/ directory, siblings of frontend/. Server-only: the home page
 * calls them at build time and prerenders the result, so a running server never
 * reads these files.
 *
 * Paths are resolved from the working directory, so builds, dev servers and
 * tests must be started from frontend/ (npm scripts do this). Edits need a
 * dev-server restart because the page reads them once at module load.
 */
function readRepoFile(...parts: string[]): string {
  const filePath = path.join(process.cwd(), "..", ...parts);
  try {
    // Normalised so Windows checkouts (CRLF) build the same documents as Linux ones.
    return readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
  } catch (error) {
    throw new Error(
      `Could not read ${filePath}. Run commands from the frontend/ directory ` +
        `(current directory: ${process.cwd()}).`,
      { cause: error },
    );
  }
}

const readTemplate = (file: string) => readRepoFile("templates", file);

/** The Mutual NDA's Cover Page and Standard Terms. */
export function loadNdaTemplates(): NdaTemplates {
  return { coverPage: readTemplate("Mutual-NDA-coverpage.md"), standardTerms: readTemplate("Mutual-NDA.md") };
}

interface RegistryEntry {
  id: string;
  template: string;
  coverPage?: string;
  parties: [string, string];
  fields: DocumentInfo["fields"];
}

/** Every supported document by id: documents.json joined with its catalog.json name, plus the template text. */
export function loadDocuments(): Record<string, DocumentInfo> {
  const catalog: { templates: { name: string; filename: string }[] } = JSON.parse(readRepoFile("catalog.json"));
  const names = new Map(catalog.templates.map((t) => [path.basename(t.filename), t.name]));
  const registry: { documents: RegistryEntry[] } = JSON.parse(readRepoFile("documents.json"));
  return Object.fromEntries(
    registry.documents.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: names.get(entry.template)!,
        parties: entry.parties,
        fields: entry.fields,
        standardTerms: readTemplate(entry.template),
        coverPage: entry.coverPage ? readTemplate(entry.coverPage) : null,
        filename: entry.template.replace(/\.md$/, ".pdf"),
      },
    ]),
  );
}
