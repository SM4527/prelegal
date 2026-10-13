import { readFileSync } from "node:fs";
import path from "node:path";
import type { NdaTemplates } from "./nda";

/**
 * Reads the Mutual NDA templates from the repo-level templates/ directory
 * (curated in PL-2, a sibling of frontend/). Server-only: the home page calls this
 * at build time and prerenders the result, so a running server never reads these files.
 *
 * The path is resolved from the working directory, so builds, dev servers and
 * tests must be started from frontend/ (npm scripts do this). Template edits
 * need a dev-server restart because the page reads them once at module load.
 */
export function loadNdaTemplates(): NdaTemplates {
  const dir = path.join(process.cwd(), "..", "templates");
  const read = (file: string) => {
    const filePath = path.join(dir, file);
    try {
      return readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new Error(
        `Could not read NDA template ${filePath}. Run commands from the frontend/ directory ` +
          `(current directory: ${process.cwd()}).`,
        { cause: error },
      );
    }
  };
  return { coverPage: read("Mutual-NDA-coverpage.md"), standardTerms: read("Mutual-NDA.md") };
}
