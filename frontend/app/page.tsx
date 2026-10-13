import { NdaCreator } from "@/components/NdaCreator";
import { loadNdaTemplates } from "@/lib/templates";

// Read once at module scope: the templates don't change per request, so the page prerenders.
const templates = loadNdaTemplates();

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Prelegal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Mutual NDA Creator</h1>
        <p className="max-w-2xl text-sm text-zinc-600">
          Fill in the key terms and the agreement updates as you type. Download the completed Mutual
          Non-Disclosure Agreement as a PDF when you&apos;re ready to sign.
        </p>
      </header>
      <NdaCreator templates={templates} />
      <footer className="border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        Based on the Common Paper Mutual NDA (Version 1.0), free to use under{" "}
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      </footer>
    </main>
  );
}
