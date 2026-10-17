import type { Metadata } from "next";
import { DocumentCreator } from "@/components/DocumentCreator";
import { loadDocuments } from "@/lib/templates";

export const metadata: Metadata = {
  // The layout's title template only applies to child routes, not this one.
  title: { absolute: "Legal Agreement Creator | Prelegal" },
  description: "Draft common legal agreements by chatting with an AI assistant, then download them as PDFs.",
};

// Read once at module scope: the templates don't change per request, so the page prerenders.
const documents = loadDocuments();

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Prelegal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Legal Agreement Creator</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Tell the assistant what you need, from an NDA to a cloud service or data processing agreement. It
          fills in the document as you answer; download it as a PDF when you&apos;re ready to sign.
        </p>
      </header>
      <DocumentCreator documents={documents} />
      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-600">
        Based on Common Paper standard agreements, free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </footer>
    </main>
  );
}
