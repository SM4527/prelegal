from datetime import date

import pytest
from litellm import APIConnectionError, AuthenticationError, RateLimitError, Timeout

from app.documents import turn_model
from app.nda import Party, Term
from conftest import llm_response, turn_json

DEFAULT_PURPOSE = "Evaluating whether to enter into a business relationship with the other party."
ACME = Party(name="Jane Doe", title="CEO", company="Acme Inc", notice_address="jane@acme.com")
GLOBEX = Party(name="", title="", company="Globex LLC", notice_address="")


def start(client) -> dict:
    response = client.post("/api/conversations")
    assert response.status_code == 201
    return response.json()


def send(client, conversation_id: str, content: str):
    return client.post(f"/api/conversations/{conversation_id}/messages", json={"content": content})


def drafting(client, fake_llm, document: str) -> str:
    """A conversation in which the user has chosen `document`; returns its id."""
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response(turn_json(f"Let's draft it. Who is party 1?", switch_to=document))
    assert send(client, conversation_id, f"I need a {document}").json()["document"] == document
    return conversation_id


def test_create_starts_with_an_ai_greeting_and_no_document(client, fake_llm):
    conversation = start(client)

    assert conversation["messages"] == [{"role": "assistant", "content": "Hello! Who are the parties?"}]
    assert conversation["document"] is None
    assert conversation["fields"]["party1"] == {"name": "", "title": "", "company": "", "noticeAddress": ""}
    assert fake_llm.call_args.kwargs["response_format"] is turn_model(None)
    # The hidden opening prompt is sent to the model but never stored.
    assert fake_llm.call_args.kwargs["messages"][-1] == {"role": "user", "content": "Begin the conversation."}


def test_greeting_cannot_choose_a_document_or_change_fields(client, fake_llm):
    fake_llm.return_value = llm_response(turn_json("Hi", switch_to="csa", party1=ACME))
    conversation = start(client)
    assert conversation["document"] is None
    assert conversation["fields"]["party1"]["company"] == ""


def test_choosing_a_document_starts_its_fields_and_keeps_the_parties(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response(
        turn_json("A Cloud Service Agreement it is. What is the Cloud Service?", switch_to="csa", party1=ACME, party2=GLOBEX)
    )

    body = send(client, conversation_id, "A CSA between Acme (provider) and Globex (customer)").json()

    assert body["document"] == "csa"
    assert body["fields"]["party1"]["company"] == "Acme Inc"
    assert body["fields"]["party2"]["company"] == "Globex LLC"
    assert body["fields"]["subscriptionPeriod"] == ""
    assert list(body["fields"])[:3] == ["party1", "party2", "cloudService"]
    assert fake_llm.call_args.kwargs["response_format"] is turn_model(None)


def test_unsupported_request_keeps_choosing(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response(turn_json("Leases aren't supported yet. Would a Pilot Agreement help?"))

    body = send(client, conversation_id, "I need a residential lease").json()

    assert body["document"] is None
    assert send(client, conversation_id, "Hmm").status_code == 200
    assert fake_llm.call_args.kwargs["response_format"] is turn_model(None)


def test_drafting_uses_the_documents_schema_and_updates_its_fields(client, fake_llm):
    conversation_id = drafting(client, fake_llm, "csa")
    fake_llm.return_value = llm_response(
        turn_json("Noted. What is the Order Date?", current="csa", party1=ACME, fees="$2,000 per month", technicalSupport="N/A")
    )

    body = send(client, conversation_id, "Fees $2,000/month; no technical support").json()

    assert fake_llm.call_args.kwargs["response_format"] is turn_model("csa")
    assert body["document"] == "csa"
    assert body["fields"]["fees"] == "$2,000 per month"
    assert body["fields"]["technicalSupport"] == "N/A"
    assert body["fields"]["party1"]["noticeAddress"] == "jane@acme.com"
    assert client.get(f"/api/conversations/{conversation_id}").json() == body


def test_switching_documents_keeps_the_parties_and_resets_the_rest(client, fake_llm):
    conversation_id = drafting(client, fake_llm, "csa")
    fake_llm.return_value = llm_response(turn_json("Noted.", current="csa", party1=ACME, fees="$2,000"))
    send(client, conversation_id, "Acme; $2,000")
    fake_llm.return_value = llm_response(turn_json("Switched. How long is the pilot?", current="csa", switch_to="pilot", party1=ACME))

    body = send(client, conversation_id, "Make it a pilot instead").json()

    assert body["document"] == "pilot"
    assert body["fields"]["party1"]["company"] == "Acme Inc"
    assert body["fields"]["fees"] == ""
    assert "subscriptionPeriod" not in body["fields"]
    assert "pilotPeriod" in body["fields"]


def test_nda_keeps_its_own_fields(client, fake_llm):
    conversation_id = drafting(client, fake_llm, "mutual-nda")
    fake_llm.return_value = llm_response(
        turn_json("Noted.", current="mutual-nda", party1=ACME, governing_law="Delaware", confidentiality_term=Term(fixed=False, years=1))
    )

    fields = send(client, conversation_id, "Acme, Delaware, confidential forever").json()["fields"]

    assert list(fields) == [
        "purpose", "effectiveDate", "mndaTerm", "confidentialityTerm",
        "governingLaw", "jurisdiction", "modifications", "party1", "party2",
    ]
    assert fields["purpose"] == DEFAULT_PURPOSE
    assert fields["confidentialityTerm"] == {"fixed": False, "years": 1}
    assert fields["party1"]["noticeAddress"] == "jane@acme.com"


def test_choosing_the_nda_starts_from_its_defaults(client, fake_llm):
    conversation_id = drafting(client, fake_llm, "mutual-nda")
    fields = client.get(f"/api/conversations/{conversation_id}").json()["fields"]
    assert fields["purpose"] == DEFAULT_PURPOSE
    assert fields["mndaTerm"] == {"fixed": True, "years": 1}


def test_send_gives_the_model_the_document_fields_today_and_history(client, fake_llm):
    conversation_id = drafting(client, fake_llm, "csa")
    fake_llm.return_value = llm_response(turn_json("Got it.", current="csa", governingLaw="Delaware"))
    send(client, conversation_id, "Delaware law")

    send(client, conversation_id, "Next question?")

    messages = fake_llm.call_args.kwargs["messages"]
    system = messages[0]["content"]
    assert messages[0]["role"] == "system"
    assert "Current document: Cloud Service Agreement (csa)" in system
    assert "party1 is the Provider and party2 is the Customer" in system
    assert "- subscriptionPeriod: Subscription Period:" in system
    assert date.today().isoformat() in system
    assert '"governingLaw":"Delaware"' in system
    assert [m["content"] for m in messages[1:]] == [
        "Hello! Who are the parties?", "I need a csa", "Let's draft it. Who is party 1?",
        "Delaware law", "Got it.", "Next question?",
    ]


def test_prompt_lists_every_supported_document_while_choosing(client, fake_llm):
    start(client)
    system = fake_llm.call_args.kwargs["messages"][0]["content"]
    assert "No document is chosen yet." in system
    for name in ["Mutual Non-Disclosure Agreement", "Cloud Service Agreement", "Business Associate Agreement", "Partnership Agreement"]:
        assert name in system


def test_each_turn_is_one_llm_call(client, fake_llm):
    conversation_id = start(client)["id"]
    send(client, conversation_id, "Hello")
    assert fake_llm.await_count == 2


def test_unknown_document_from_the_model_is_502_and_stores_nothing(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response(turn_json("x", switch_to="csa").replace('"csa"', '"lease"'))

    assert send(client, conversation_id, "A lease").status_code == 502
    assert client.get(f"/api/conversations/{conversation_id}").json()["document"] is None


def test_unknown_conversation_is_404(client, fake_llm):
    assert client.get("/api/conversations/nope").status_code == 404
    response = send(client, "nope", "Hi")
    assert response.status_code == 404
    assert response.json() == {"detail": "Conversation not found."}
    fake_llm.assert_not_awaited()


@pytest.mark.parametrize("content", ["", "x" * 4001])
def test_message_length_is_validated(client, fake_llm, content):
    conversation_id = start(client)["id"]
    assert send(client, conversation_id, content).status_code == 422


def test_rate_limit_is_503_and_stores_nothing(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.side_effect = RateLimitError("limit", "groq", "openai/gpt-oss-120b")

    response = send(client, conversation_id, "Hello")

    assert response.status_code == 503
    assert response.json() == {"detail": "The assistant is busy, please try again in a minute."}
    assert len(client.get(f"/api/conversations/{conversation_id}").json()["messages"]) == 1


def test_rate_limit_on_create_is_503(client, fake_llm):
    fake_llm.side_effect = RateLimitError("limit", "groq", "openai/gpt-oss-120b")
    assert client.post("/api/conversations").status_code == 503


def test_unusable_model_output_is_502_and_stores_nothing(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response("not json")

    response = send(client, conversation_id, "Hello")

    assert response.status_code == 502
    assert response.json() == {"detail": "The assistant gave an unusable answer, please try again."}
    assert len(client.get(f"/api/conversations/{conversation_id}").json()["messages"]) == 1


@pytest.mark.parametrize(
    "error",
    [
        AuthenticationError("bad key", "groq", "openai/gpt-oss-120b"),
        Timeout("slow", "openai/gpt-oss-120b", "groq"),
        APIConnectionError("down", "groq", "openai/gpt-oss-120b"),
    ],
    ids=["auth", "timeout", "connection"],
)
def test_other_llm_failures_are_503_and_store_nothing(client, fake_llm, error):
    conversation_id = start(client)["id"]
    fake_llm.side_effect = error

    response = send(client, conversation_id, "Hello")

    assert response.status_code == 503
    assert response.json() == {"detail": "The assistant is unavailable right now, please try again."}
    assert len(client.get(f"/api/conversations/{conversation_id}").json()["messages"]) == 1


def test_conversations_do_not_survive_a_restart(client, fake_llm):
    conversation_id = start(client)["id"]
    client.__exit__(None, None, None)
    client.__enter__()
    assert client.get(f"/api/conversations/{conversation_id}").status_code == 404
