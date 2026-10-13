# prelegal
A platform for drafting common legal agreements

> **🚧 Status: In progress** — This project is under active development and is expected to be completed by **October 20, 2026**.

## Repository layout

- `templates/`: Common Paper legal agreement templates (CC BY 4.0), listed in `catalog.json`.
- `frontend/`: Next.js app. The first feature is the Mutual NDA Creator: fill in a form, preview the agreement, and download it as a PDF.

## Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm test           # unit and component tests
npm run test:e2e   # browser tests (uses installed Chrome and Edge)
```

See [frontend/README.md](frontend/README.md) and [frontend/TESTING.md](frontend/TESTING.md) for details.
