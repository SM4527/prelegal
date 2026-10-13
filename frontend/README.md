# Prelegal frontend: Mutual NDA Creator

A Next.js app where a user fills in the key terms of a Mutual Non-Disclosure Agreement, sees the completed agreement update live, and downloads it as a PDF.

The agreement text comes from the Common Paper Mutual NDA templates in the repo-level [`templates/`](../templates) directory (CC BY 4.0), which are read at build time.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Command         | Purpose                         |
| --------------- | ------------------------------- |
| `npm run dev`   | Start the development server    |
| `npm run build` | Production build (static page)  |
| `npm start`     | Serve the production build      |
| `npm test`      | Run unit tests (Vitest)         |
| `npm run lint`  | Lint with ESLint                |

Run commands from this `frontend/` directory: the template loader resolves `../templates` relative to the working directory.

## How it works

- **`app/page.tsx`**: reads the Cover Page and Standard Terms templates when the page is built, so the page is prerendered as static HTML.
- **`lib/nda.ts`**: the form data model and `buildNdaMarkdown()`.
  - Fills in the Cover Page placeholders, checkboxes and signature table, then appends the Standard Terms.
  - User input is markdown-escaped, so it always displays literally.
  - Filling throws an error if the template text changes in a way it no longer recognizes.
- **`components/NdaCreator.tsx`**: holds the form state and passes the generated markdown to the preview and the download button.
- **`components/NdaPreview.tsx`**: renders the markdown with `react-markdown` and `remark-gfm`. Raw HTML is not rendered.
- **`components/NdaPdf.tsx`**: parses the same markdown and maps it to `@react-pdf/renderer` primitives. The Standard Terms start on a new page.
- **`components/DownloadButton.tsx`**: loads the PDF library only when the user clicks it, then saves `Mutual-NDA.pdf`.

The signature and date cells in the PDF are left blank, to be signed by hand or through an e-signature tool.
