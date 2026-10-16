"""Live LLM checks, opt-in: `uv run pytest -m integration` (needs GROQ_API_KEY)."""

import os

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not os.getenv("GROQ_API_KEY"), reason="GROQ_API_KEY is not set"),
]


def test_chat_fills_in_the_nda(client):
    conversation = client.post("/api/conversations").json()
    assert conversation["messages"][0]["content"]

    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"content": "Acme Inc and Globex LLC. Delaware law. The MNDA lasts 3 years; confidentiality is forever."},
    )

    fields = response.json()["fields"]
    assert response.status_code == 200
    assert "Acme" in fields["party1"]["company"] + fields["party2"]["company"]
    assert "Delaware" in fields["governingLaw"]
    assert fields["mndaTerm"] == {"fixed": True, "years": 3}
    assert fields["confidentialityTerm"]["fixed"] is False
