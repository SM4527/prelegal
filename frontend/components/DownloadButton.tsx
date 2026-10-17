"use client";

import { useState } from "react";
import { buttonPrimary, errorClass } from "@/lib/ui";

/** Generates the document's PDF in the browser and saves it. The PDF library is loaded on first click. */
export function DownloadButton({ markdown, title, filename }: { markdown: string; title: string; filename: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const working = status === "working";

  async function download() {
    if (working) return;
    setStatus("working");
    try {
      const [{ pdf }, { DocumentPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./DocumentPdf"),
      ]);
      const blob = await pdf(<DocumentPdf markdown={markdown} title={title} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate the PDF", error);
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* aria-disabled rather than disabled, so keyboard focus stays on the button while working. */}
      <button
        type="button"
        onClick={download}
        aria-disabled={working}
        className={`${buttonPrimary} w-full`}
      >
        {working ? "Preparing PDF…" : "Download PDF"}
      </button>
      <p className="text-center text-xs text-slate-500">A draft for review by a lawyer before signing.</p>
      <p aria-live="polite" className="sr-only">
        {working ? "Preparing PDF" : ""}
      </p>
      {status === "error" && (
        <p role="alert" className={errorClass}>
          Sorry, the PDF could not be generated. Please try again.
        </p>
      )}
    </div>
  );
}
