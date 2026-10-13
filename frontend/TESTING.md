# Testing the Mutual NDA Creator

Run every command from the `frontend/` directory.

## Automated tests

| Command | What it runs | Approx. time |
| --- | --- | --- |
| `npm test` | Unit and component tests (Vitest) | ~5 s |
| `npm run test:e2e` | Browser end-to-end tests (Playwright). Builds the app and serves it on port 3100 | ~1 min |
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

**`components/NdaCreator.test.tsx`: the form and live preview (component tests in jsdom)**
- Default values, and today's date used in the document while the date field is blank.
- Choosing and then clearing the effective date.
- Typing into each field updates the preview.
- Switching each term between a fixed length and open-ended, and restoring the chosen years when switching back.
- Filling both parties into the table.
- Markdown and HTML input shown as literal text.
- Multi-line modifications.
- Accessibility:
  - radio groups have a name and description
  - each field's hint is its description, not part of its name
  - the preview's checkboxes have names
  - the component has no `h1` of its own

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

**`e2e/nda-creator.spec.ts`: the real app in Chrome, Edge and mobile Chrome (Playwright)**
- The page loads with no console or page errors.
- Today's date is filled in by the browser.
- Filling every field and clicking Download saves `Mutual-NDA.pdf`, whose text contains all the entered details.
- Repeated downloads reflect edits made in between.
- If the PDF library can't load (offline), an error appears, and a retry works once back online.
- The PDF library loads only when Download is clicked.
- Keyboard-only use works: typing, Tab, arrow keys between radios, and Enter on Download (focus stays on the button).
- HTML and markdown in the input are shown as text, with no `<img>`, emphasis or `javascript:` links in the preview.
- No horizontal scrolling at desktop or phone width.

## Manual test plan

Some things automation can't check well: how the file looks in real PDF viewers, printing, screen readers, and browsers we don't automate. Run this checklist before a release and whenever the templates, the PDF layout or the form change.

Setup: `npm install`, then `npm run dev`, then open http://localhost:3000.

| # | Area | Steps | Expected |
| --- | --- | --- | --- |
| M1 | First load | Open the page. | The form is on the left and the full NDA on the right (stacked on a phone). The Effective Date in the document is today. Nothing flickers or jumps. |
| M2 | Live preview | Type into every field. | Each value appears in the right place in the preview as you type. |
| M3 | Terms | For both terms, pick 5 years, switch to the other option, then switch back. | The dropdown is greyed out while unused. Switching back restores 5. The preview checkboxes follow the radios. |
| M4 | Effective date | Pick a date, then clear it. | The document shows the picked date, then today again. The field can be cleared and retyped. |
| M5 | Download (Chrome, Edge) | Fill everything and click **Download PDF**. | `Mutual-NDA.pdf` downloads within a few seconds, with all the values. |
| M6 | Download (Firefox, Safari) | Repeat M5 in Firefox and Safari. | Same as M5. (These browsers are not covered by the automated tests.) |
| M7 | PDF viewers | Open the PDF in a browser viewer, Adobe Acrobat Reader and macOS Preview. | Four Letter-size pages. Cover Page first, the signature table intact, the Standard Terms starting on a new page. Text can be selected and searched. Links work. |
| M8 | Printing | Print the PDF. | Margins are fine and nothing is cut off. The signature table has room to sign by hand. |
| M9 | Keyboard | Without a mouse, Tab through the whole form, change both terms with the arrow keys, and press Enter on Download. | Every control is reachable in a sensible order with a visible focus ring, and the download works. |
| M10 | Screen reader | With NVDA (Windows) or VoiceOver (macOS), move through the form and press Download. | Fields read as "label, edit, hint". Radios read with their group name ("MNDA term"). "Preparing PDF" is announced. Preview checkboxes read as "Selected" / "Not selected". |
| M11 | Zoom | Zoom the browser to 200%. | Everything stays usable, with no overlapping or clipped controls. |
| M12 | Phone | Use a real phone (or devtools device mode). | No sideways scrolling. Inputs don't zoom awkwardly. Download works (iOS may open the PDF in a viewer instead of saving it). |
| M13 | Odd input | Enter `*bold* \| <b>x</b> [link](https://x.com)`, very long text, and multi-line modifications. | Shown literally in both the preview and the PDF, with the table intact and long text wrapping. |
| M14 | Known limitation | Enter a non-Latin name, for example `Łukasz`, `Иван`, `山田` or an emoji. | The preview is correct, but the PDF drops or garbles these characters, because it uses the built-in Helvetica font. This is a known gap, not a regression. |
| M15 | Errors | In devtools, set the network to Offline after the page loads, then click Download. | A red "PDF could not be generated" message appears. Going back online and retrying works. (Also automated in the end-to-end tests.) |

Record each run with the date, browser and OS versions, and any deviations, for example in the PR description.
