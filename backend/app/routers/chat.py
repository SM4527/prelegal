"""Chat API: the assistant fills in the Mutual NDA from a freeform conversation."""

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app import conversations
from app.llm import complete_structured
from app.nda import CamelModel, NdaFields, NdaTurn, default_fields, system_prompt

router = APIRouter(prefix="/api/conversations", tags=["chat"])

# Sent to the model to produce the greeting; never stored or shown.
OPENING_PROMPT = "Begin the conversation."


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class ConversationOut(CamelModel):
    id: str
    messages: list[MessageOut]
    fields: NdaFields


async def _ask(fields: NdaFields, history: list[dict[str, str]], user_text: str) -> NdaTurn:
    """One LLM call: the current fields and history in, the reply and updated fields out."""
    messages = [
        {"role": "system", "content": system_prompt(fields, date.today())},
        *history,
        {"role": "user", "content": user_text},
    ]
    return await complete_structured(messages, NdaTurn)


def _load(conversation_id: str) -> ConversationOut:
    conversation = conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    return ConversationOut(id=conversation.id, messages=conversation.messages, fields=conversation.fields)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation() -> ConversationOut:
    """Start a conversation with an AI-generated greeting."""
    fields = default_fields()
    turn = await _ask(fields, [], OPENING_PROMPT)
    # The user hasn't said anything yet, so only the greeting is kept.
    return _load(conversations.create(fields, turn.reply))


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str) -> ConversationOut:
    return _load(conversation_id)


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: str, message: MessageIn) -> ConversationOut:
    """Send a user message; the reply and updated fields are stored only if the LLM call succeeds."""
    conversation = _load(conversation_id)
    history = [m.model_dump() for m in conversation.messages]
    turn = await _ask(conversation.fields, history, message.content)
    conversations.add_turn(conversation_id, message.content, turn.reply, turn.fields)
    return _load(conversation_id)
