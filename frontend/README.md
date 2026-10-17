# Prelegal frontend: Mutual NDA Creator

A Next.js app where a user chats with an AI assistant about a Mutual Non-Disclosure Agreement, sees the agreement fill in live from the answers, and downloads it as a PDF.

The agreement text comes from the Common Paper Mutual NDA templates in the repo-level [`templates/`](../templates) directory (CC BY 4.0), which are read at build time.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Command         | Purpose                         |
| --------------- | ------------------------------- |
| `npm run dev`   | Start the development server    |
| `npm run build` | Static export to `out/` (served by the backend) |
| `npm test`      | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser end-to-end tests (Playwright, Chrome and Edge) |
| `npm run lint`  | Lint with ESLint                |
| `npm run typecheck` | Generate route types, then run `tsc --noEmit` |

See [TESTING.md](TESTING.md) for what the test suites cover, and for the manual test plan.

Notes:
- **Working directory:** run commands from this `frontend/` directory. The template loader resolves `../templates` relative to the working directory, and fails with a clear error if run from elsewhere. In production the backend serves `out/`; see the root README.
- **Template edits:** the templates are read once when the page module loads, so restart `npm run dev` after editing them.
- **Type-checking:** `LayoutProps` and other route types are generated. Run `npm run typecheck` (or `next dev` or `next build`) before running `tsc` on a fresh clone.
- **Tailwind:** Tailwind CSS is wired through the `@tailwindcss/turbopack` loader in `next.config.ts`, so builds must use Turbopack (the default). `next build --webpack` would not process the CSS.
- **Node.js:** needs Node.js 20.9 or later.
- **Chat:** the assistant is served by the backend under `/api`, so `npm run dev` alone shows the page without a working chat. Build and run the backend (root README) to chat.

## How it works

- **`app/page.tsx`**: reads the Cover Page and Standard Terms templates when the page is built, so the page is prerendered as static HTML.
- **`lib/nda.ts`**: the NDA data model (`NdaFormData`, the shape the backend returns) and `buildNdaMarkdown()`.
  - Fills in the Cover Page placeholders, checkboxes and signature table, then appends the Standard Terms.
  - User input is markdown-escaped, so it always displays literally.
  - Filling throws an error if the template text changes in a way it no longer recognizes.
- **`lib/useConversation.ts`**: starts or resumes the chat (the id is kept in `localStorage`), sends messages, and handles errors, retry and start over.
- **`components/DocumentCreator.tsx`**: shows the chat and builds the markdown for the preview and download from the fields the assistant has filled in.
- **`components/AssistantChat.tsx`** and **`ChatInput.tsx`**: the message history, typing indicator, errors with Retry, and the message box (Enter sends, Shift+Enter adds a line).
- **`components/DocumentPreview.tsx`**: renders the markdown with `react-markdown` and `remark-gfm`. Raw HTML is not rendered.
- **`components/DocumentPdf.tsx`**: parses the same markdown and maps it to `@react-pdf/renderer` primitives. The Standard Terms start on a new page.
- **`components/DownloadButton.tsx`**: loads the PDF library only when the user clicks it, then saves `Mutual-NDA.pdf`.

The signature and date cells in the PDF are left blank, to be signed by hand or through an e-signature tool.

Known limitation: the PDF uses the built-in Helvetica font, which covers Western European (Latin-1) characters only. Other scripts and emoji, for example `Ł`, Cyrillic, CJK or 🚀, show correctly in the preview but are garbled in the PDF.
