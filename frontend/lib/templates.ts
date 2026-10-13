import { readFileSync } from "node:fs";
import path from "node:path";
import type { NdaTemplates } from "./nda";

/**
 * Reads the Mutual NDA templates from the repo-level templates/ directory
 * (curated in PL-2, a sibling of frontend/). Server-only; runs at build time.
 * Paths are literal so the build traces only these files.
 */
export function loadNdaTemplates(): NdaTemplates {
  return {
    coverPage: readFileSync(path.join(process.cwd(), "..", "templates", "Mutual-NDA-coverpage.md"), "utf-8"),
    standardTerms: readFileSync(path.join(process.cwd(), "..", "templates", "Mutual-NDA.md"), "utf-8"),
  };
}
