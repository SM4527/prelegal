# Prelegal frontend: Legal Agreement Creator

A Next.js app where a user tells an AI assistant which agreement they need (an NDA, cloud service agreement, DPA and more), sees it fill in live from their answers, and downloads it as a PDF.

The agreement text comes from the Common Paper templates in the repo-level [`templates/`](../templates) directory (CC BY 4.0). They are read at build time, together with `catalog.json` and `documents.json`.

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
- **`lib/templates.ts`**: reads the registry and template text at build time (`loadDocuments()`), normalising line endings.
- **`lib/documents.ts`**: `buildDocumentMarkdown()`. The Mutual NDA uses its official Cover Page; every other document gets a generated Cover Page (key terms table and signature table with its party labels) followed by its Standard Terms.
- **`lib/nda.ts`**: the NDA data model (`NdaFormData`), `buildNdaMarkdown()` and the shared markdown escaping helpers.
  - Fills in the Cover Page placeholders, checkboxes and signature table, then appends the Standard Terms.
  - User input is markdown-escaped, so it always displays literally.
  - Filling throws an error if the template text changes in a way it no longer recognizes.
- **`lib/useConversation.ts`**: opens the conversation in `/?c=<id>`, starts a new one on `/?new`, or resumes the stored one (the id is kept in `localStorage`); sends messages, and handles errors, retry and New document.
- **`lib/user.tsx`**: `UserProvider` asks the backend once per page load who is signed in; `useUser()` reads it (`undefined` while checking, `null` when signed out).
- **`components/AppHeader.tsx`**: logo, New document and My documents links, and the account's email with Sign out, or Sign in and Sign up.
- **`components/DocumentHistory.tsx`** (`/documents/`): the signed-in user's documents, each reopening in the creator.
- **`components/AuthPage.tsx`** and **`AuthForm.tsx`**: the sign-in and sign-up screens.
- **`lib/ui.ts`**: shared button, input, link and card classes. **`lib/disclaimer.ts`**: the draft notice shown with every document and in the PDF.
- **`components/DocumentCreator.tsx`**: shows the chat and builds the markdown for the preview and download from the fields the assistant has filled in.
- **`components/AssistantChat.tsx`** and **`ChatInput.tsx`**: the message history, typing indicator, errors with Retry, and the message box (Enter sends, Shift+Enter adds a line).
- **`components/DocumentPreview.tsx`**: renders the markdown with `react-markdown` and `remark-gfm`. Raw HTML is not rendered.
- **`components/DocumentPdf.tsx`**: parses the same markdown and maps it to `@react-pdf/renderer` primitives. The Standard Terms start on a new page.
- **`components/DownloadButton.tsx`**: loads the PDF library only when the user clicks it, then saves the PDF named after the template (e.g. `CSA.pdf`).

The signature and date cells in the PDF are left blank, to be signed by hand or through an e-signature tool.

Known limitation: the PDF uses the built-in Helvetica font, which covers Western European (Latin-1) characters only. Other scripts and emoji, for example `Ł`, Cyrillic, CJK or 🚀, show correctly in the preview but are garbled in the PDF.
