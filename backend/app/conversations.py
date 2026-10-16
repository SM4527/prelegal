"""Storage for chat conversations: the NDA fields so far and the message history."""

from contextlib import closing
from typing import Literal
from uuid import uuid4

from app.db import connect
from app.nda import CamelModel, NdaFields


class Message(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class Conversation(CamelModel):
    id: str
    messages: list[Message]
    fields: NdaFields


def create(fields: NdaFields, greeting: str) -> Conversation:
    """Store a new conversation that opens with the assistant's greeting."""
    conversation = Conversation(id=uuid4().hex, messages=[Message(role="assistant", content=greeting)], fields=fields)
    with closing(connect()) as conn, conn:
        conn.execute(
            "INSERT INTO conversations (id, fields) VALUES (?, ?)",
            (conversation.id, fields.model_dump_json(by_alias=True)),
        )
        _add_message(conn, conversation.id, conversation.messages[0])
    return conversation


def get(conversation_id: str) -> Conversation | None:
    with closing(connect()) as conn:
        row = conn.execute("SELECT fields FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        if row is None:
            return None
        messages = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,)
        ).fetchall()
    return Conversation(
        id=conversation_id,
        messages=[Message(**message) for message in messages],
        fields=NdaFields.model_validate_json(row["fields"]),
    )


def add_turn(conversation: Conversation, user_text: str, reply: str, fields: NdaFields) -> Conversation:
    """Store a user message, the assistant's reply and the updated fields in one transaction."""
    new_messages = [Message(role="user", content=user_text), Message(role="assistant", content=reply)]
    with closing(connect()) as conn, conn:
        for message in new_messages:
            _add_message(conn, conversation.id, message)
        conn.execute(
            "UPDATE conversations SET fields = ? WHERE id = ?",
            (fields.model_dump_json(by_alias=True), conversation.id),
        )
    return Conversation(id=conversation.id, messages=[*conversation.messages, *new_messages], fields=fields)


def _add_message(conn, conversation_id: str, message: Message) -> None:
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, message.role, message.content),
    )
