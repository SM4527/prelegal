"""Chat API: the assistant works out which document the user needs and fills it in from the conversation."""

from datetime import date

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app import conversations
from app.auth import CurrentUser, OptionalUser, User
from app.conversations import Conversation, Message, Summary
from app.documents import default_fields, fields_model, turn_model
from app.llm import complete_structured
from app.prompts import system_prompt

router = APIRouter(prefix="/api/conversations", tags=["chat"])

# Sent to the model to produce the greeting; never stored or shown.
OPENING_PROMPT = "Begin the conversation."


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


async def _ask(document: str | None, fields: BaseModel, history: list[Message], user_text: str):
    """One LLM call: the current document, fields and history in; the document, fields and reply out."""
    messages = [
        {"role": "system", "content": system_prompt(document, fields, date.today())},
        *(message.model_dump() for message in history),
        {"role": "user", "content": user_text},
    ]
    return await complete_structured(messages, turn_model(document))


def _next_state(document: str | None, turn) -> tuple[str | None, BaseModel]:
    """The document and fields after a turn. A newly chosen document starts from its defaults, keeping the parties."""
    if turn.document == document:
        return document, turn.fields
    fields = default_fields(turn.document)
    fields.party1, fields.party2 = turn.fields.party1, turn.fields.party2
    return turn.document, fields


def _load(conversation_id: str, user: User | None) -> Conversation:
    """The conversation if this user may see it (404 otherwise); a signed-in user claims an unowned one."""
    conversation = conversations.get(conversation_id, user.id if user else None)
    if conversation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    if user:
        conversations.claim(conversation_id, user.id)
    return conversation


@router.get("")
def list_conversations(user: CurrentUser) -> list[Summary]:
    """The signed-in user's documents, most recently updated first."""
    return conversations.list_for_user(user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_conversation(user: OptionalUser) -> Conversation:
    """Start a conversation with an AI-generated greeting."""
    fields = default_fields(None)
    turn = await _ask(None, fields, [], OPENING_PROMPT)
    # The user hasn't said anything yet, so only the greeting is kept.
    return conversations.create(fields, turn.reply, user.id if user else None)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, user: OptionalUser) -> Conversation:
    return _load(conversation_id, user)


@router.post("/{conversation_id}/messages")
async def send_message(conversation_id: str, message: MessageIn, user: OptionalUser) -> Conversation:
    """Send a user message; the reply and updated state are stored only if the LLM call succeeds."""
    conversation = _load(conversation_id, user)
    fields = fields_model(conversation.document).model_validate(conversation.fields)
    turn = await _ask(conversation.document, fields, conversation.messages, message.content)
    document, fields = _next_state(conversation.document, turn)
    return conversations.add_turn(conversation, message.content, turn.reply, document, fields)
