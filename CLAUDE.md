# CLAUDE.md

Prelegal: a platform for drafting common legal agreements. General coding principles live in `../CLAUDE.md`; this file covers this repo only.

# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

Current state: every document in the catalog is supported, chosen and filled in through AI chat. See "Implementation status" below.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, follow the `groq-llm` and `openrouter-llm` skills (in `.claude/skills/`) to use LiteLLM with Groq as the primary provider (`groq/openai/gpt-oss-120b`) and OpenRouter's free model (`openrouter/nvidia/nemotron-3-super-120b-a12b:free`; the free gpt-oss-120b was withdrawn) as the fallback when Groq is rate-limited or unavailable. Only use free models: never use a paid model or pin a paid inference provider such as Cerebras. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document. The shared client is `backend/app/llm.py`; reuse it.

There is a GROQ_API_KEY and an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLite and be created from scratch each time the Docker container is brought up, with a users table for sign up and sign in (placeholders for now) and the chat conversations.  
The frontend is statically exported (`frontend/out/`) and served by FastAPI.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

These are Tailwind theme colors in `frontend/app/globals.css`: `brand-yellow`, `brand-blue`, `brand-purple`, `brand-navy`, `brand-gray`.

## Implementation status

- **PL-2**: Common Paper templates in `templates/`, listed in `catalog.json`.
- **PL-3**: Mutual NDA Creator (Next.js 16): live preview and PDF download in the browser (its form was replaced by the chat in PL-5). Templates (and, since PL-6, `catalog.json` and `documents.json`) are read at build time from `../`, so build from `frontend/`.
- **PL-4**: V1 foundation (PR #5).
  - Frontend: `output: "export"` with `trailingSlash: true`. `cacheComponents`/`partialPrefetching` must stay off: they enable PPR, which breaks static export.
  - Backend: `backend/app/` with `main.py` (API under `/api`, static mount at `/` last), `db.py` (SQLite recreated on every start; `DB_PATH`, `STATIC_DIR` env overrides), `routers/health.py`, `routers/auth.py`.
  - Auth is a placeholder: `/api/auth/{signup,signin,signout,me}` return 501; `/signin/` and `/signup/` pages call them via `frontend/lib/api.ts`.
  - Docker: multi-stage `Dockerfile`, `docker-compose.yml` (port 8000, `.env` optional); scripts wrap `docker compose up -d --build` / `down`.
  - Tests: `uv run pytest` (backend), `npm test` (Vitest), `npm run test:e2e` (Playwright against FastAPI serving the build on port 3100).
- **PL-5**: AI chat replaces the NDA form (PR #6).
  - Backend: `llm.py` (LiteLLM Router, Groq then OpenRouter fallback; one structured call per turn, no streaming, no re-ask), `nda.py` (camelCase Pydantic models matching `NdaFormData`, `Literal` years 1-10), `conversations.py` (SQLite `conversations` and `messages`), `routers/chat.py` (`POST /api/conversations` with AI greeting, `GET /{id}`, `POST /{id}/messages`). A turn is stored only after the LLM call succeeds. Rate limit or other provider failure -> 503, invalid output -> 502. No retries; the fallback is the retry (timeouts: Groq 30s, OpenRouter 60s).
  - Frontend: `lib/useConversation.ts` (id in `localStorage`, resume, retry, start over), `components/AssistantChat.tsx`, `ChatInput.tsx`. `NdaForm` was removed.
  - Tests mock the LLM (`app.llm._router.acompletion`; Playwright stubs `/api/conversations`).
- **PL-6**: all catalog documents (PR #7).
  - `documents.json` (repo root) lists each document's template, party labels and curated key terms; names and descriptions come from `catalog.json`. Adding a document = template + catalog entry + documents.json entry. Docker copies both JSON files.
  - Backend: `documents.py` (registry; per-document Pydantic schemas built with `create_model`; `turn_model(document)` has no fields but the parties until a document is chosen), `prompts.py` (catalog list, choosing vs drafting rules). `conversations` gained a `document` column. Switching documents keeps the parties and resets the rest. Blank = not given yet; "N/A" = does not apply.
  - The prompt must tell the model to always answer with a JSON object: without it, Groq's gpt-oss sometimes answered unsupported requests in plain text (`json_validate_failed`).
  - The Mutual NDA keeps its official Cover Page; other documents get a generated Cover Page (key terms and signatures) before their Standard Terms (`frontend/lib/documents.ts`). Templates are embedded at build time; line endings are normalised to LF.
  - Components were renamed to `DocumentCreator`, `DocumentPreview`, `DocumentPdf`, `AssistantChat`. The message box keeps focus after sending and when replies arrive.
  - The OpenRouter fallback is `nvidia/nemotron-3-super-120b-a12b:free` (the free gpt-oss-120b was withdrawn in October 2026); it is slower than Groq (about 10-30s a turn).
  - The DPA's deeply indented lettered clauses parse as a markdown code block; the PDF and preview render code blocks as plain text so they are not lost.
  - Groq free tier allows about 8,000 tokens a minute (a turn is about 1.5k), so space out live tests; `uv run pytest -m integration` runs three paced scenarios.
- **Next**: real auth in `routers/auth.py`.