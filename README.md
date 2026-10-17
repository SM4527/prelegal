# prelegal
A platform for drafting common legal agreements

> **Status: In progress.** This project is under active development and is expected to be completed by **October 20, 2026**.

## Repository layout

- `templates/`: Common Paper legal agreement templates (CC BY 4.0), listed in `catalog.json`.
- `frontend/`: Next.js app, statically exported to `frontend/out/`. Features the Mutual NDA Creator, where an AI assistant fills in the agreement from a chat, plus sign-in and sign-up pages (placeholders).
- `backend/`: FastAPI app (uv project). Serves the API under `/api` (including the chat at `/api/conversations`) and the frontend build at `/`. Its SQLite database, which stores users and conversations, is recreated on every start.
- `scripts/`: start and stop the Docker container.

## Run with Docker

Copy `.env.example` to `.env` and fill in the API keys (`GROQ_API_KEY`, with `OPENROUTER_API_KEY` as the fallback; both free tiers). The chat needs them. Then:

```bash
scripts/start-mac.sh        # or start-linux.sh, or scripts\start-windows.ps1
scripts/stop-mac.sh         # or stop-linux.sh, or scripts\stop-windows.ps1
```

The app runs at http://localhost:8000.

## Local development

```bash
cd frontend && npm install && npm run build   # build the static site to frontend/out
cd backend && uv run uvicorn app.main:app --reload   # http://localhost:8000
```

For UI work, `npm run dev` in `frontend/` gives hot reload at http://localhost:3000, without the backend API.

## Tests

```bash
cd backend && uv run pytest        # API (LLM mocked), database and static serving
cd backend && uv run pytest -m integration   # one live chat against Groq
cd frontend && npm test            # unit and component tests
cd frontend && npm run test:e2e    # browser tests against FastAPI serving the build
```

Account sign-up and sign-in are placeholders: the pages and `/api/auth/*` routes exist, but the routes respond `501 Not Implemented`.

See [frontend/README.md](frontend/README.md) and [frontend/TESTING.md](frontend/TESTING.md) for details.
