// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DownloadButton } from "./DownloadButton";

// vi.mock factories are hoisted above imports, so shared mocks are created with vi.hoisted.
const mocks = vi.hoisted(() => ({ toBlob: vi.fn(), pdf: vi.fn() }));
const { toBlob } = mocks;
vi.mock("@react-pdf/renderer", () => ({ pdf: mocks.pdf }));
vi.mock("./NdaPdf", () => ({ NdaPdfDocument: () => null }));

let linkClicks: ReturnType<typeof vi.spyOn>;
/** The <a> element the download clicked, if any. */
const clickedLink = () => linkClicks.mock.contexts[0] as HTMLAnchorElement | undefined;

beforeEach(() => {
  mocks.pdf.mockImplementation(() => ({ toBlob }));
  URL.createObjectURL = vi.fn(() => "blob:nda");
  URL.revokeObjectURL = vi.fn();
  linkClicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  toBlob.mockReset();
});

describe("DownloadButton", () => {
  it("generates the PDF and saves it as Mutual-NDA.pdf", async () => {
    const blob = new Blob(["%PDF-"], { type: "application/pdf" });
    toBlob.mockResolvedValue(blob);
    render(<DownloadButton markdown="# NDA" />);

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(clickedLink()).toBeDefined());
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickedLink()!.href).toBe("blob:nda");
    expect(clickedLink()!.download).toBe("Mutual-NDA.pdf");
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:nda"), { timeout: 2000 });
  });

  it("marks itself busy while the PDF is prepared, keeps focus, and ignores repeat clicks", async () => {
    let finish!: (blob: Blob) => void;
    toBlob.mockReturnValue(new Promise<Blob>((resolve) => (finish = resolve)));
    render(<DownloadButton markdown="# NDA" />);

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    const busy = await screen.findByRole("button", { name: "Preparing PDF…" });
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(busy).toHaveFocus();
    expect(screen.getByText("Preparing PDF", { selector: "[aria-live]" })).toBeInTheDocument();

    await userEvent.click(busy);
    expect(toBlob).toHaveBeenCalledTimes(1);

    finish(new Blob(["%PDF-"]));
    const ready = await screen.findByRole("button", { name: "Download PDF" });
    expect(ready).toHaveAttribute("aria-disabled", "false");
    await waitFor(() => expect(clickedLink()).toBeDefined());
  });

  it("passes the current markdown to the PDF document", async () => {
    toBlob.mockResolvedValue(new Blob(["%PDF-"]));
    render(<DownloadButton markdown="# Specific NDA" />);
    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(clickedLink()).toBeDefined());
    expect(mocks.pdf.mock.calls[0][0].props).toEqual({ markdown: "# Specific NDA" });
  });

  it("shows an error and allows a retry when generation fails", async () => {
    toBlob.mockRejectedValueOnce(new Error("boom"));
    render(<DownloadButton markdown="# NDA" />);

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be generated");
    expect(clickedLink()).toBeUndefined();

    toBlob.mockResolvedValueOnce(new Blob(["%PDF-"]));
    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() => expect(clickedLink()).toBeDefined());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
