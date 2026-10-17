# Testing the Mutual NDA Creator

Run every command from the `frontend/` directory.

## Automated tests

| Command | What it runs | Approx. time |
| --- | --- | --- |
| `npm test` | Unit and component tests (Vitest) | ~5 s |
| `npm run test:e2e` | Browser end-to-end tests (Playwright). Builds the static site and serves it through the FastAPI backend on port 3100 (needs `uv`) | ~1 min |
| `npm run lint` | ESLint | ~5 s |
| `npm run typecheck` | Generates route types, then runs `tsc --noEmit` | ~10 s |

The end-to-end tests use the Chrome and Edge already installed on your machine. On a machine without them, run `npx playwright install chrome msedge`. If a test fails, Playwright saves a trace; open it with `npx playwright show-trace <path>`.

### What each suite covers

**`lib/nda.test.ts`: template filling (unit tests)**
- Loads the real templates from `../templates`, so a change to the templates that breaks filling fails here.
- Fills every Cover Page field and both term options in each state, including 1 vs. many years and open-ended terms.
- Fills the party table and leaves the signature and date cells blank.
- Shows placeholders for empty or whitespace-only values.
- Handles multi-line fields, including Windows `\r\n` line endings.
- Collapses line breaks in table cells.
- Escapes every ASCII punctuation character, so user input can't inject markdown or HTML.
- Can't be hijacked by user text that matches another placeholder.
- Fails loudly if the template text has changed.
- Formats dates without timezone shifts.
- Includes all 11 Standard Terms sections.

**`components/NdaCreator.test.tsx`: the chat and live preview (component tests in jsdom, chat API mocked)**
- Starts a conversation with the assistant's greeting and remembers its id; resumes it after a reload, or starts afresh if the backend no longer knows it.
- Default document, with today's date while no date is chosen.
- Sending a message shows it at once with a typing indicator, then the reply; the preview fills in from the returned fields (dates, both term styles, parties, multi-line modifications).
- Enter sends, Shift+Enter adds a line, blank messages are ignored.
- Errors (busy assistant, network failure, failed start) show an alert, and Retry resends without duplicating the message.
- Start over gives a fresh conversation and document.
- Messages and values are shown literally, never as markdown or HTML.
- Accessibility: messages are labelled by speaker, the preview's checkboxes have names, and the component has no `h1` of its own.

**`components/DownloadButton.test.tsx`: the download flow (component tests, PDF library mocked)**
- Saves the file as `Mutual-NDA.pdf` and revokes the blob URL afterwards.
- While busy, the button is marked `aria-disabled`, keeps keyboard focus, announces "Preparing PDF" to screen readers, and ignores repeat clicks.
- Passes the current markdown to the PDF document.
- On failure, shows an error alert, and a retry works.

**`components/NdaPdf.test.tsx`: PDF content (renders a real PDF and extracts its text)**
- All entered values and `[X]`/`[ ]` markers appear in the PDF.
- The Standard Terms start on a new page.
- Sections 1–11 are numbered in order.
- Missing values show placeholders.
- The signature and date cells are blank.
- User input is printed literally.
- Line breaks are kept.
- Very long input flows onto extra pages.

**`e2e/nda-creator.spec.ts`: the real app in Chrome, Edge and mobile Chrome (Playwright, chat API stubbed so no LLM is called)**
- The page loads with the greeting and no console or page errors; today's date is filled in by the browser.
- A chat turn fills in the agreement, and Download saves `Mutual-NDA.pdf` containing all the details.
- Repeated downloads reflect changes made in the chat in between.
- The conversation survives a reload; Start over begins a new one.
- A busy assistant shows an alert, and Retry resends the message once.
- If the PDF library can't load (offline), an error appears, and a retry works once back online. The library loads only when Download is clicked.
- Keyboard-only use works: type, Enter to send (focus stays in the message box), Enter on Download.
- HTML and markdown in messages and values are shown as text.
- No horizontal scrolling at desktop or phone width.

**`lib/api.test.ts` and `components/AuthForm.test.tsx`: placeholder auth (unit and component tests)**
- The API client calls the right `/api/auth/*` and `/api/conversations/*` routes and methods, and turns error responses into an `ApiError` with FastAPI's `detail`.
- The sign-in and sign-up forms submit the credentials, show the backend's error message or a generic one, and link to each other.

**`e2e/auth.spec.ts`: sign-in and sign-up pages against the real backend (Playwright)**
- Each page submits to its route, which responds 501, and shows the message.
- `/signin` redirects to `/signin/`, and the pages link to each other.
- The backend health check responds.

Backend tests live in `../backend/tests` (`uv run pytest` from `backend/`). They cover the fresh database on each start, the chat API with the LLM mocked (one structured call per turn, nothing stored when it fails, 503 when busy, 502 on unusable output), the placeholder auth routes and the static file serving. `uv run pytest -m integration` runs one live chat against Groq (needs `GROQ_API_KEY`).

## Manual test plan

Some things automation can't check well: how the file looks in real PDF viewers, printing, screen readers, and browsers we don't automate. Run this checklist before a release and whenever the templates, the PDF layout, the chat or the assistant's prompt change.

Setup: put the API keys in `.env`, run `scripts/start-windows.ps1` (or the Mac/Linux script), then open http://localhost:8000.

| # | Area | Steps | Expected |
| --- | --- | --- | --- |
| M1 | First load | Open the page. | The chat is on the left with the assistant's greeting, and the full NDA on the right (stacked on a phone). The Effective Date in the document is today. Nothing flickers or jumps. |
| M2 | Chat fills the NDA | Answer the assistant's questions in your own words, giving several details at once. | Each detail appears in the right place in the preview. The assistant confirms what it recorded and asks about what is missing, without inventing values. |
| M3 | Terms | Say "the NDA lasts 5 years", then "actually until terminated", and "confidentiality forever". | The preview checkboxes follow each answer. |
| M4 | Effective date | Say "starting next Monday", then give an exact date. | The document shows the resolved date, then the exact date. |
| M5 | Download (Chrome, Edge) | Fill everything and click **Download PDF**. | `Mutual-NDA.pdf` downloads within a few seconds, with all the values. |
| M6 | Download (Firefox, Safari) | Repeat M5 in Firefox and Safari. | Same as M5. (These browsers are not covered by the automated tests.) |
| M7 | PDF viewers | Open the PDF in a browser viewer, Adobe Acrobat Reader and macOS Preview. | Four Letter-size pages. Cover Page first, the signature table intact, the Standard Terms starting on a new page. Text can be selected and searched. Links work. |
| M8 | Printing | Print the PDF. | Margins are fine and nothing is cut off. The signature table has room to sign by hand. |
| M9 | Keyboard | Without a mouse, type a message, press Enter, then Tab to Download and press Enter. | Every control is reachable with a visible focus ring, focus stays in the message box after sending, and the download works. |
| M10 | Screen reader | With NVDA (Windows) or VoiceOver (macOS), send a message and press Download. | Messages read as "You: ..." and "Assistant: ...". "Assistant is typing" is announced. "Preparing PDF" is announced. Preview checkboxes read as "Selected" / "Not selected". |
| M11 | Zoom | Zoom the browser to 200%. | Everything stays usable, with no overlapping or clipped controls. |
| M12 | Phone | Use a real phone (or devtools device mode). | No sideways scrolling. Inputs don't zoom awkwardly. Download works (iOS may open the PDF in a viewer instead of saving it). |
| M13 | Odd input | Give a company name like `*bold* | <b>x</b> [link](https://x.com)`, very long text, and multi-line modifications. | Shown literally in the chat, the preview and the PDF, with the table intact and long text wrapping. |
| M14 | Known limitation | Enter a non-Latin name, for example `Łukasz`, `Иван`, `山田` or an emoji. | The preview is correct, but the PDF drops or garbles these characters, because it uses the built-in Helvetica font. This is a known gap, not a regression. |
| M15 | Errors | In devtools, set the network to Offline after the page loads, then click Download. | A red "PDF could not be generated" message appears. Going back online and retrying works. (Also automated in the end-to-end tests.) |
| M16 | Busy assistant | Send many messages quickly until the free-tier limit is hit (or stop the network to the backend). | A red alert explains the problem; Retry resends the last message. |

Record each run with the date, browser and OS versions, and any deviations, for example in the PR description.
