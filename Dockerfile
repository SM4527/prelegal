# Stage 1: static frontend build. templates/ must sit beside frontend/,
# because the build reads ../templates.
FROM node:24-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY templates /build/templates
COPY frontend ./
RUN npm run build

# Stage 2: FastAPI backend serving the API and the frontend build.
FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --frozen --no-dev
COPY backend/app ./app
COPY --from=frontend /build/frontend/out /app/frontend/out
ENV PATH="/app/backend/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
