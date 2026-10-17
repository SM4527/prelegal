"""Live LLM checks, opt-in: `uv run pytest -m integration` (needs GROQ_API_KEY).

Calls are spaced out to stay inside Groq's free-tier tokens-per-minute limit.
"""

import os
import time

import pytest

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not os.getenv("GROQ_API_KEY"), reason="GROQ_API_KEY is not set"),
]


@pytest.fixture
def chat(client):
    """Sends a message in a fresh conversation and returns the updated conversation."""
    conversation = client.post("/api/conversations").json()
    assert conversation["messages"][0]["content"].rstrip().endswith("?")

    def say(text: str) -> dict:
        time.sleep(10)
        response = client.post(f"/api/conversations/{conversation['id']}/messages", json={"content": text})
        assert response.status_code == 200
        return response.json()

    return say


def last_reply(conversation: dict) -> str:
    return conversation["messages"][-1]["content"].rstrip()


def test_chooses_the_nda_and_fills_it_in_asking_follow_up_questions(chat):
    conversation = chat("I need a mutual NDA between Acme Inc and Globex LLC.")
    assert conversation["document"] == "mutual-nda"
    assert last_reply(conversation).endswith("?")

    conversation = chat("Delaware law. The MNDA lasts 3 years; confidentiality is forever.")
    fields = conversation["fields"]
    assert "Acme" in fields["party1"]["company"] + fields["party2"]["company"]
    assert "Delaware" in fields["governingLaw"]
    assert fields["mndaTerm"] == {"fixed": True, "years": 3}
    assert fields["confidentialityTerm"]["fixed"] is False
    assert last_reply(conversation).endswith("?")


def test_unsupported_document_offers_the_closest_one(chat):
    conversation = chat("I need an employment contract for a new hire.")
    assert conversation["document"] is None
    assert last_reply(conversation).endswith("?")


def test_switching_documents_keeps_the_parties(chat):
    conversation = chat("I need a cloud service agreement: Acme Inc is the provider, Globex LLC the customer.")
    assert conversation["document"] == "csa"

    conversation = chat("Actually, make it a pilot agreement instead.")
    assert conversation["document"] == "pilot"
    assert conversation["fields"]["party1"]["company"] == "Acme Inc"
    assert last_reply(conversation).endswith("?")
