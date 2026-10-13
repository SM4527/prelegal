// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadNdaTemplates } from "@/lib/templates";
import { NdaCreator } from "./NdaCreator";

const templates = loadNdaTemplates();

function setup() {
  const user = userEvent.setup();
  render(<NdaCreator templates={templates} />);
  const preview = screen.getByRole("region", { name: "Mutual NDA preview" });
  return { user, preview };
}

/** The preview's paragraph that follows a given cover-page heading. */
function sectionText(preview: HTMLElement, heading: string) {
  return within(preview).getByRole("heading", { name: heading }).nextElementSibling?.textContent;
}

/** The checkbox in the preview's list item that contains the given text. */
function previewCheckbox(preview: HTMLElement, text: RegExp) {
  const item = within(preview).getByText(text).closest("li")!;
  return within(item).getByRole("checkbox");
}

/** The preview signature-table row for a label, as [label, party1, party2]. */
function tableRow(preview: HTMLElement, label: string) {
  const row = within(preview).getByRole("cell", { name: label }).closest("tr")!;
  return within(row).getAllByRole("cell").map((cell) => cell.textContent);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 13, 12));
});
afterEach(() => vi.useRealTimers());

describe("NdaCreator", () => {
  it("renders the full agreement with sensible defaults", () => {
    const { preview } = setup();
    expect(within(preview).getByRole("heading", { level: 2, name: "Mutual Non-Disclosure Agreement" })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { level: 2, name: "Standard Terms" })).toBeInTheDocument();
    expect(sectionText(preview, "Purpose")).toBe(
      "Evaluating whether to enter into a business relationship with the other party.",
    );
    expect(previewCheckbox(preview, /Expires 1 year from Effective Date/)).toBeChecked();
    expect(previewCheckbox(preview, /Continues until terminated/)).not.toBeChecked();
    expect(previewCheckbox(preview, /1 year from Effective Date, but/)).toBeChecked();
    expect(previewCheckbox(preview, /In perpetuity/)).not.toBeChecked();
    expect(within(preview).getByText("Governing Law: [Governing Law]")).toBeInTheDocument();
    expect(tableRow(preview, "Print Name")).toEqual(["Print Name", "[Print Name]", "[Print Name]"]);
  });

  it("uses today in the document while the effective date field is blank", () => {
    const { preview } = setup();
    const date = screen.getByLabelText("Effective date");
    expect(date).toHaveValue("");
    expect(date).toHaveAccessibleDescription("Leave blank to use today's date");
    expect(sectionText(preview, "Effective Date")).toBe("October 13, 2026");
  });

  it("uses a chosen effective date, and today again once it is cleared", () => {
    const { preview } = setup();
    const date = screen.getByLabelText("Effective date");
    // Date inputs only accept complete values, so set them in one change.
    fireEvent.change(date, { target: { value: "2027-02-01" } });
    expect(sectionText(preview, "Effective Date")).toBe("February 1, 2027");

    fireEvent.change(date, { target: { value: "" } });
    expect(date).toHaveValue("");
    expect(sectionText(preview, "Effective Date")).toBe("October 13, 2026");
  });

  it("updates the preview as the key terms are typed", async () => {
    const { user, preview } = setup();
    await user.clear(screen.getByLabelText("Purpose"));
    await user.type(screen.getByLabelText("Purpose"), "Exploring a partnership");
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
    await user.type(screen.getByLabelText("Jurisdiction"), "courts located in New Castle, DE");

    expect(sectionText(preview, "Purpose")).toBe("Exploring a partnership");
    expect(within(preview).getByText("Governing Law: Delaware")).toBeInTheDocument();
    expect(within(preview).getByText("Jurisdiction: courts located in New Castle, DE")).toBeInTheDocument();
  });

  it("switches the MNDA term and restores the chosen length when switching back", async () => {
    const { user, preview } = setup();
    const years = screen.getByRole("combobox", { name: "MNDA term in years" });

    await user.selectOptions(years, "3");
    expect(previewCheckbox(preview, /Expires 3 years from Effective Date/)).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Continues until terminated" }));
    expect(years).toBeDisabled();
    expect(previewCheckbox(preview, /Continues until terminated/)).toBeChecked();
    expect(previewCheckbox(preview, /Expires \[N years\]/)).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Expires after" }));
    expect(years).toBeEnabled();
    expect(years).toHaveValue("3");
    expect(previewCheckbox(preview, /Expires 3 years/)).toBeChecked();
  });

  it("switches the confidentiality term between years and perpetuity", async () => {
    const { user, preview } = setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "Term of confidentiality in years" }), "5");
    expect(previewCheckbox(preview, /5 years from Effective Date, but/)).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "In perpetuity" }));
    expect(previewCheckbox(preview, /In perpetuity/)).toBeChecked();
    expect(previewCheckbox(preview, /\[N years\] from Effective Date, but/)).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Protected for" }));
    expect(previewCheckbox(preview, /5 years from Effective Date, but/)).toBeChecked();
  });

  it("fills both parties into the signature table", async () => {
    const { user, preview } = setup();
    const companies = screen.getAllByLabelText("Company");
    const names = screen.getAllByLabelText("Signer name");
    const titles = screen.getAllByLabelText("Title");
    const addresses = screen.getAllByLabelText("Notice address");

    await user.type(companies[0], "Acme Inc.");
    await user.type(names[0], "Ada Lovelace");
    await user.type(titles[0], "CEO");
    await user.type(addresses[0], "1 Main St, Springfield");
    await user.type(companies[1], "Globex LLC");
    await user.type(names[1], "Alan Turing");

    expect(tableRow(preview, "Company")).toEqual(["Company", "Acme Inc.", "Globex LLC"]);
    expect(tableRow(preview, "Print Name")).toEqual(["Print Name", "Ada Lovelace", "Alan Turing"]);
    expect(tableRow(preview, "Title")).toEqual(["Title", "CEO", "[Title]"]);
    expect(tableRow(preview, "Notice Address")).toEqual(["Notice Address", "1 Main St, Springfield", "[Notice Address]"]);
    expect(tableRow(preview, "Signature")).toEqual(["Signature", "", ""]);
    expect(tableRow(preview, "Date")).toEqual(["Date", "", ""]);
  });

  it("shows user input literally instead of interpreting markdown or HTML", async () => {
    const { user, preview } = setup();
    // user-event treats "[" as a key descriptor; "[[" types a literal bracket.
    await user.type(screen.getAllByLabelText("Company")[0], "*Acme* | <b>Ltd</b> [[x](javascript:alert(1))");

    expect(tableRow(preview, "Company")[1]).toBe("*Acme* | <b>Ltd</b> [x](javascript:alert(1))");
    expect(preview.querySelector("b, em, script, a[href^='javascript']")).toBeNull();
  });

  it("lists modifications line by line, or None when empty", async () => {
    const { user, preview } = setup();
    expect(sectionText(preview, "MNDA Modifications")).toBe("None.");

    await user.type(screen.getByLabelText("Modifications"), "First change{Enter}Second change");
    const paragraph = within(preview).getByRole("heading", { name: "MNDA Modifications" }).nextElementSibling!;
    expect(paragraph.querySelector("br")).not.toBeNull();
    expect(paragraph.textContent).toBe("First change\nSecond change");
  });

  it("groups each term's radio buttons under its question", () => {
    setup();
    const mnda = screen.getByRole("group", { name: "MNDA term" });
    expect(mnda).toHaveAccessibleDescription("The length of this MNDA");
    expect(within(mnda).getAllByRole("radio")).toHaveLength(2);
    const confidentiality = screen.getByRole("group", { name: "Term of confidentiality" });
    expect(within(confidentiality).getAllByRole("radio")).toHaveLength(2);
  });

  it("names fields by their label and describes them by their hint", () => {
    setup();
    expect(screen.getByLabelText("Purpose")).toHaveAccessibleDescription("How Confidential Information may be used");
    expect(screen.getAllByLabelText("Notice address")[0]).toHaveAccessibleDescription(
      "Email or postal address for legal notices",
    );
  });

  it("gives the preview's checkboxes accessible names", () => {
    const { preview } = setup();
    const checkboxes = within(preview).getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    for (const checkbox of checkboxes) {
      expect(checkbox).toHaveAccessibleName(/^(Selected|Not selected)$/);
    }
  });

  it("renders no h1 of its own, leaving that to the page", () => {
    setup();
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0);
  });

  it("offers a PDF download", () => {
    setup();
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });
});
