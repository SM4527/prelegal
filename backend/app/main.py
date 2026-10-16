"""FastAPI app: the JSON API under /api, and the static frontend build at /."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import init_db
from app.routers import auth, health

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parents[2] / "frontend" / "out"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
# Mounted last so the /api routes take precedence.
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
