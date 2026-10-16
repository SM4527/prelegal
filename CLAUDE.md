# CLAUDE.md

Prelegal: a platform for drafting common legal agreements. General coding principles live in `../CLAUDE.md`; this file covers this repo only.

# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

Current state: only the Mutual NDA document is supported, filled in through AI chat. See "Implementation status" below.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your free-llm skill to use LiteLLM with Groq as the primary provider (`groq/openai/gpt-oss-120b`) and OpenRouter's free model (`openrouter/openai/gpt-oss-120b:free`) as the fallback when Groq is rate-limited or unavailable. Only use free models: never use a paid model or pin a paid inference provider such as Cerebras. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is a GROQ_API_KEY and an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
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
- **PL-3**: Mutual NDA Creator (Next.js 16): form, live preview, PDF download in the browser. Templates are read at build time from `../templates`, so build from `frontend/`.
- **PL-4**: V1 foundation.
  - Frontend: `output: "export"` with `trailingSlash: true`. `cacheComponents`/`partialPrefetching` must stay off: they enable PPR, which breaks static export.
  - Backend: `backend/app/` with `main.py` (API under `/api`, static mount at `/` last), `db.py` (SQLite recreated on every start; `DB_PATH`, `STATIC_DIR` env overrides), `routers/health.py`, `routers/auth.py`.
  - Auth is a placeholder: `/api/auth/{signup,signin,signout,me}` return 501; `/signin/` and `/signup/` pages call them via `frontend/lib/api.ts`.
  - Docker: multi-stage `Dockerfile`, `docker-compose.yml` (port 8000, `.env` optional); scripts wrap `docker compose up -d --build` / `down`.
  - Tests: `uv run pytest` (backend), `npm test` (Vitest), `npm run test:e2e` (Playwright against FastAPI serving the build on port 3100).
- **PL-5**: AI chat replaces the NDA form.
  - Backend: `llm.py` (LiteLLM Router, Groq then OpenRouter fallback; one structured call per turn, no streaming, no re-ask), `nda.py` (camelCase Pydantic models matching `NdaFormData`, `Literal` years 1-10, system prompt), `conversations.py` (SQLite `conversations` and `messages`), `routers/chat.py` (`POST /api/conversations` with AI greeting, `GET /{id}`, `POST /{id}/messages`). A turn is stored only after the LLM call succeeds. Rate limit -> 503, invalid output -> 502.
  - Frontend: `lib/useConversation.ts` (id in `localStorage`, resume, retry, start over), `components/NdaChat.tsx`, `ChatInput.tsx`. `NdaForm` was removed.
  - Tests mock the LLM (`app.llm._router.acompletion`; Playwright stubs `/api/conversations`). `uv run pytest -m integration` makes one live call.
- **Next**: real auth in `routers/auth.py`, more document types.