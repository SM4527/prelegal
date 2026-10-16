"""Point the app at a temporary database and a stub frontend build before importing it."""

import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_tmp = Path(tempfile.mkdtemp())
STATIC_DIR = _tmp / "out"
for page, title in [("", "Home"), ("signin/", "Sign in"), ("signup/", "Sign up")]:
    (STATIC_DIR / page).mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / page / "index.html").write_text(f"<title>{title}</title>")
os.environ["STATIC_DIR"] = str(STATIC_DIR)
os.environ["DB_PATH"] = str(_tmp / "data" / "test.db")

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    """A client with the app's lifespan run, so the database is freshly created."""
    with TestClient(app) as c:
        yield c
