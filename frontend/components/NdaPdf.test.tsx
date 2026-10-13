import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildNdaMarkdown, defaultFormData } from "@/lib/nda";
import { loadNdaTemplates } from "@/lib/templates";
import { NdaPdfDocument } from "./NdaPdf";

describe("NdaPdfDocument", () => {
  it("renders the full NDA to a multi-page PDF", async () => {
    const markdown = buildNdaMarkdown(loadNdaTemplates(), {
      ...defaultFormData,
      effectiveDate: "2026-10-13",
      governingLaw: "Delaware",
      party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
    });
    const buffer = await renderToBuffer(<NdaPdfDocument markdown={markdown} />);

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const pageCount = buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
  });
});
