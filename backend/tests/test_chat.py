from datetime import date

import pytest
from litellm import APIConnectionError, AuthenticationError, RateLimitError, Timeout

from app.nda import Party, Term
from conftest import llm_response, turn_json

DEFAULT_PURPOSE = "Evaluating whether to enter into a business relationship with the other party."


def start(client) -> dict:
    response = client.post("/api/conversations")
    assert response.status_code == 201
    return response.json()


def send(client, conversation_id: str, content: str):
    return client.post(f"/api/conversations/{conversation_id}/messages", json={"content": content})


def test_create_starts_with_an_ai_greeting_and_default_fields(client, fake_llm):
    conversation = start(client)

    assert conversation["messages"] == [{"role": "assistant", "content": "Hello! Who are the parties?"}]
    assert conversation["fields"]["purpose"] == DEFAULT_PURPOSE
    assert conversation["fields"]["mndaTerm"] == {"fixed": True, "years": 1}
    # The hidden opening prompt is sent to the model but never stored.
    assert fake_llm.call_args.kwargs["messages"][-1] == {"role": "user", "content": "Begin the conversation."}


def test_greeting_cannot_change_the_fields(client, fake_llm):
    fake_llm.return_value = llm_response(turn_json("Hi", governing_law="Invented"))
    assert start(client)["fields"]["governingLaw"] == ""


def test_api_uses_the_frontend_field_names(client, fake_llm):
    fields = start(client)["fields"]

    assert list(fields) == [
        "purpose", "effectiveDate", "mndaTerm", "confidentialityTerm",
        "governingLaw", "jurisdiction", "modifications", "party1", "party2",
    ]
    assert list(fields["party1"]) == ["name", "title", "company", "noticeAddress"]


def test_send_updates_fields_and_stores_both_messages(client, fake_llm):
    conversation_id = start(client)["id"]
    acme = Party(name="Jane Doe", title="CEO", company="Acme Inc", notice_address="jane@acme.com")
    fake_llm.return_value = llm_response(
        turn_json("Noted Acme.", party1=acme, governing_law="Delaware", confidentiality_term=Term(fixed=False, years=1))
    )

    response = send(client, conversation_id, "Acme Inc, Jane Doe CEO, Delaware, confidential forever")

    assert response.status_code == 200
    body = response.json()
    assert [m["role"] for m in body["messages"]] == ["assistant", "user", "assistant"]
    assert body["messages"][1]["content"] == "Acme Inc, Jane Doe CEO, Delaware, confidential forever"
    assert body["messages"][2]["content"] == "Noted Acme."
    assert body["fields"]["party1"]["noticeAddress"] == "jane@acme.com"
    assert body["fields"]["confidentialityTerm"] == {"fixed": False, "years": 1}
    assert client.get(f"/api/conversations/{conversation_id}").json() == body


def test_send_gives_the_model_the_current_fields_today_and_history(client, fake_llm):
    conversation_id = start(client)["id"]
    fake_llm.return_value = llm_response(turn_json("Got it.", governing_law="Delaware"))
    send(client, conversation_id, "Delaware law")

    send(client, conversation_id, "Next question?")

    messages = fake_llm.call_args.kwargs["messages"]
    system = messages[0]["content"]
    assert messages[0]["role"] == "system"
    assert date.today().isoformat() in system
    assert '"governingLaw":"Delaware"' in system
    assert messages[1:] == [
        {"role": "assistant", "content": "Hello! Who are the parties?"},
        {"role": "user", "content": "Delaware law"},
        {"role": "assistant", "content": "Got it."},
        {"role": "user", "content": "Next question?"},
    ]


def test_each_turn_is_one_llm_call(client, fake_llm):
    conversation_id = start(client)["id"]
    send(client, conversation_id, "Hello")
    assert fake_llm.await_count == 2


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


def test_conversations_do_not_survive_a_restart(client, fake_llm):
    conversation_id = start(client)["id"]
    client.__exit__(None, None, None)
    client.__enter__()
    assert client.get(f"/api/conversations/{conversation_id}").status_code == 404


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
