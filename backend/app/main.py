"""FastAPI app: the JSON API under /api, and the static frontend build at /."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from litellm import RateLimitError

from app.db import init_db
from app.llm import LlmOutputError
from app.routers import auth, chat, health

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parents[2] / "frontend" / "out"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)


@app.exception_handler(RateLimitError)
async def assistant_busy(request: Request, exc: RateLimitError) -> JSONResponse:
    detail = "The assistant is busy, please try again in a minute."
    return JSONResponse({"detail": detail}, status.HTTP_503_SERVICE_UNAVAILABLE)


@app.exception_handler(LlmOutputError)
async def assistant_unusable(request: Request, exc: LlmOutputError) -> JSONResponse:
    detail = "The assistant gave an unusable answer, please try again."
    return JSONResponse({"detail": detail}, status.HTTP_502_BAD_GATEWAY)


# Mounted last so the /api routes take precedence.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
