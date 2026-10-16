"""LLM calls through LiteLLM: Groq first, OpenRouter's free model as fallback. Structured outputs only."""

import os
from typing import TypeVar

from dotenv import load_dotenv
from litellm import Router
from pydantic import BaseModel, ValidationError

load_dotenv()

T = TypeVar("T", bound=BaseModel)

_router = Router(
    model_list=[
        {
            "model_name": "primary",
            "litellm_params": {"model": "groq/openai/gpt-oss-120b", "api_key": os.getenv("GROQ_API_KEY")},
        },
        {
            "model_name": "fallback",
            "litellm_params": {
                "model": "openrouter/openai/gpt-oss-120b:free",
                "api_key": os.getenv("OPENROUTER_API_KEY"),
                "extra_body": {"provider": {"require_parameters": True}},
            },
        },
    ],
    fallbacks=[{"primary": ["fallback"]}],
    num_retries=2,
    timeout=60,
)


class LlmOutputError(Exception):
    """The model's reply did not match the requested schema."""


async def complete_structured(messages: list[dict], schema: type[T]) -> T:
    """Make one LLM call and return its reply validated as `schema`."""
    response = await _router.acompletion(
        model="primary", messages=messages, response_format=schema, temperature=0.2
    )
    try:
        return schema.model_validate_json(response.choices[0].message.content)
    except ValidationError as error:
        raise LlmOutputError from error
