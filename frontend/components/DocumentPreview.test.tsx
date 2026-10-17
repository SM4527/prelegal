// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildDocumentMarkdown, type DocumentFields } from "@/lib/documents";
import { loadDocuments } from "@/lib/templates";
import { DocumentPreview } from "./DocumentPreview";

const dpa = loadDocuments().dpa;
const emptyParty = { name: "", title: "", company: "", noticeAddress: "" };

describe("DocumentPreview", () => {
  it("shows deeply indented template clauses as ordinary text, not code", () => {
    const fields = { party1: emptyParty, party2: emptyParty, ...Object.fromEntries(dpa.fields.map((f) => [f.key, ""])) };
    const { container } = render(<DocumentPreview markdown={buildDocumentMarkdown(dpa, fields as DocumentFields, "2026-10-13")} />);

    const clause = screen.getByText(/The optional docking clause in Clause 7 does not apply/);
    expect(clause.tagName).toBe("P");
    expect(clause).toHaveTextContent(/does not apply;\s+ii\. In Clause 9, Option 2/);
    expect(container.querySelector("pre, code")).toBeNull();
  });
});
