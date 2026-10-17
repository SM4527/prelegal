"""Chat API: the assistant fills in the Mutual NDA from a freeform conversation."""

from datetime import date

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app import conversations
from app.conversations import Conversation, Message
from app.llm import complete_structured
from app.nda import NdaFields, NdaTurn, default_fields, system_prompt

router = APIRouter(prefix="/api/conversations", tags=["chat"])

# Sent to the model to produce the greeting; never stored or shown.
OPENING_PROMPT = "Begin the conversation."


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


async def _ask(fields: NdaFields, history: list[Message], user_text: str) -> NdaTurn:
    """One LLM call: the current fields and history in, the reply and updated fields out."""
    messages = [
        {"role": "system", "content": system_prompt(fields, date.today())},
        *(message.model_dump() for message in history),
        {"role": "user", "content": user_text},
    ]
    return await complete_structured(messages, NdaTurn)


def _load(conversation_id: str) -> Conversation:
    conversation = conversations.get(conversation_id)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    return conversation


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation() -> Conversation:
    """Start a conversation with an AI-generated greeting."""
    fields = default_fields()
    turn = await _ask(fields, [], OPENING_PROMPT)
    # The user hasn't said anything yet, so only the greeting is kept.
    return conversations.create(fields, turn.reply)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str) -> Conversation:
    return _load(conversation_id)


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: str, message: MessageIn) -> Conversation:
    """Send a user message; the reply and updated fields are stored only if the LLM call succeeds."""
    conversation = _load(conversation_id)
    turn = await _ask(conversation.fields, conversation.messages, message.content)
    return conversations.add_turn(conversation, message.content, turn.reply, turn.fields)
