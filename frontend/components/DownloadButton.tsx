"use client";

import { useState } from "react";

/** Generates the NDA PDF in the browser and saves it. The PDF library is loaded on first click. */
export function DownloadButton({ markdown }: { markdown: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    setStatus("working");
    try {
      const [{ pdf }, { NdaPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./NdaPdf"),
      ]);
      const blob = await pdf(<NdaPdfDocument markdown={markdown} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Mutual-NDA.pdf";
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate NDA PDF", error);
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={download}
        disabled={status === "working"}
        className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60"
      >
        {status === "working" ? "Preparing PDF…" : "Download PDF"}
      </button>
      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Sorry, the PDF could not be generated. Please try again.
        </p>
      )}
    </div>
  );
}
