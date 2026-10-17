import pytest

from app.llm import LlmOutputError, complete_structured
from app.nda import NdaTurn
from conftest import llm_response, turn_json

MESSAGES = [{"role": "user", "content": "Hi"}]


async def test_returns_validated_schema(fake_llm):
    fake_llm.return_value = llm_response(turn_json("Hi there", governing_law="Delaware"))

    turn = await complete_structured(MESSAGES, NdaTurn)

    assert turn.reply == "Hi there"
    assert turn.fields.governing_law == "Delaware"


async def test_makes_one_structured_call_to_the_primary_model(fake_llm):
    await complete_structured(MESSAGES, NdaTurn)

    fake_llm.assert_awaited_once()
    kwargs = fake_llm.call_args.kwargs
    assert kwargs["model"] == "primary"
    assert kwargs["messages"] == MESSAGES
    assert kwargs["response_format"] is NdaTurn
    assert "stream" not in kwargs


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        '{"reply": "missing fields"}',
        turn_json("x").replace('"years":1', '"years":11', 1),
    ],
    ids=["invalid-json", "missing-fields", "years-out-of-range"],
)
async def test_invalid_output_raises_without_retrying(fake_llm, content):
    fake_llm.return_value = llm_response(content)

    with pytest.raises(LlmOutputError):
        await complete_structured(MESSAGES, NdaTurn)
    fake_llm.assert_awaited_once()
