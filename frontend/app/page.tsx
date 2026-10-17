import type { Metadata } from "next";
import { DocumentCreator } from "@/components/DocumentCreator";
import { loadNdaTemplates } from "@/lib/templates";

export const metadata: Metadata = {
  // The layout's title template only applies to child routes, not this one.
  title: { absolute: "Mutual NDA Creator | Prelegal" },
  description: "Draft a Mutual Non-Disclosure Agreement by chatting with an AI assistant, then download it as a PDF.",
};

// Read once at module scope: the templates don't change per request, so the page prerenders.
const templates = loadNdaTemplates();

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Prelegal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Mutual NDA Creator</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Chat with the assistant about your agreement and the document fills itself in as you answer.
          Download the completed Mutual Non-Disclosure Agreement as a PDF when you&apos;re ready to sign.
        </p>
      </header>
      <DocumentCreator templates={templates} />
      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-600">
        Based on the Common Paper Mutual NDA (Version 1.0), free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </footer>
    </main>
  );
}
