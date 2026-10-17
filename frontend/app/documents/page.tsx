import type { Metadata } from "next";
import { DocumentHistory } from "@/components/DocumentHistory";
import { buttonPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "My documents" };

export default function MyDocuments() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy">My documents</h1>
          <p className="text-slate-600">Every agreement you have drafted. Open one to keep editing or download it.</p>
        </div>
        <a href="/?new" className={buttonPrimary}>New document</a>
      </header>
      <DocumentHistory />
    </main>
  );
}
