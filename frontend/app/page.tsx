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
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-blue">AI drafting assistant</p>
        <h1 className="text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">Legal Agreement Creator</h1>
        <p className="max-w-2xl text-slate-600">
          Tell the assistant what you need, from an NDA to a cloud service or data processing agreement. It
          fills in the document as you answer; download it as a PDF when you&apos;re ready to sign.
        </p>
      </header>
      <DocumentCreator documents={documents} />
    </main>
  );
}
