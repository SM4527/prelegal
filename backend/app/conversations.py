"""Storage for chat conversations: the chosen document, its fields so far, and the message history."""

import json
from contextlib import closing
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel

from app.db import connect
from app.nda import CamelModel


class Message(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class Conversation(CamelModel):
    id: str
    messages: list[Message]
    document: str | None
    fields: dict[str, Any]


def create(fields: BaseModel, greeting: str) -> Conversation:
    """Store a new conversation, with no document chosen yet, that opens with the assistant's greeting."""
    conversation = Conversation(
        id=uuid4().hex,
        messages=[Message(role="assistant", content=greeting)],
        document=None,
        fields=fields.model_dump(by_alias=True),
    )
    with closing(connect()) as conn, conn:
        conn.execute(
            "INSERT INTO conversations (id, fields) VALUES (?, ?)", (conversation.id, json.dumps(conversation.fields))
        )
        _add_message(conn, conversation.id, conversation.messages[0])
    return conversation


def get(conversation_id: str) -> Conversation | None:
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT document, fields FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone()
        if row is None:
            return None
        messages = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,)
        ).fetchall()
    return Conversation(
        id=conversation_id,
        messages=[Message(**message) for message in messages],
        document=row["document"],
        fields=json.loads(row["fields"]),
    )


def add_turn(
    conversation: Conversation, user_text: str, reply: str, document: str | None, fields: BaseModel
) -> Conversation:
    """Store a user message, the assistant's reply, the document and its fields in one transaction."""
    new_messages = [Message(role="user", content=user_text), Message(role="assistant", content=reply)]
    updated = Conversation(
        id=conversation.id,
        messages=[*conversation.messages, *new_messages],
        document=document,
        fields=fields.model_dump(by_alias=True),
    )
    with closing(connect()) as conn, conn:
        for message in new_messages:
            _add_message(conn, conversation.id, message)
        conn.execute(
            "UPDATE conversations SET document = ?, fields = ? WHERE id = ?",
            (document, json.dumps(updated.fields), conversation.id),
        )
    return updated


def _add_message(conn, conversation_id: str, message: Message) -> None:
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, message.role, message.content),
    )
