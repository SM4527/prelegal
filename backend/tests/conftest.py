"""Point the app at a temporary database and a stub frontend build before importing it."""

import os
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

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
from app.nda import NdaTurn, default_fields  # noqa: E402


@pytest.fixture
def client():
    """A client with the app's lifespan run, so the database is freshly created."""
    with TestClient(app) as c:
        yield c


def llm_response(content: str) -> SimpleNamespace:
    """A LiteLLM-shaped completion whose message is `content`."""
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def turn_json(reply: str, **fields) -> str:
    """An NdaTurn as the model would return it: the default fields with `fields` overridden."""
    nda = default_fields().model_copy(update=fields)
    return NdaTurn(fields=nda, reply=reply).model_dump_json(by_alias=True)


@pytest.fixture
def fake_llm():
    """Replaces the LLM router call; set `return_value` or `side_effect` to llm_response(...)."""
    with patch("app.llm._router.acompletion", new_callable=AsyncMock) as mock:
        mock.return_value = llm_response(turn_json("Hello! Who are the parties?"))
        yield mock
