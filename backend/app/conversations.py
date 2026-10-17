"""Storage for chat conversations: the chosen document, its fields so far, and the message history."""

import json
from contextlib import closing
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel

from app.db import connect
from app.documents import DOCUMENTS
from app.nda import CamelModel


class Message(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class Conversation(CamelModel):
    id: str
    messages: list[Message]
    document: str | None
    fields: dict[str, Any]


class Summary(CamelModel):
    """A conversation as listed in the user's documents."""

    id: str
    document: str
    document_name: str
    parties: list[str]
    updated_at: str


def create(fields: BaseModel, greeting: str, user_id: int | None) -> Conversation:
    """Store a new conversation, with no document chosen yet, that opens with the assistant's greeting.

    Conversations started while signed out have no owner until a signed-in user opens them.
    """
    conversation = Conversation(
        id=uuid4().hex,
        messages=[Message(role="assistant", content=greeting)],
        document=None,
        fields=fields.model_dump(by_alias=True),
    )
    with closing(connect()) as conn, conn:
        conn.execute(
            "INSERT INTO conversations (id, user_id, fields) VALUES (?, ?, ?)",
            (conversation.id, user_id, json.dumps(conversation.fields)),
        )
        _add_message(conn, conversation.id, conversation.messages[0])
    return conversation


def get(conversation_id: str, user_id: int | None) -> Conversation | None:
    """The conversation, if it has no owner or belongs to `user_id`."""
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT document, fields FROM conversations WHERE id = ? AND (user_id IS NULL OR user_id = ?)",
            (conversation_id, user_id),
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
            "UPDATE conversations SET document = ?, fields = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ?",
            (document, json.dumps(updated.fields), conversation.id),
        )
    return updated


def claim(conversation_id: str, user_id: int) -> None:
    """Give an unowned conversation to `user_id`, so a draft started before signing in is saved to the account."""
    with closing(connect()) as conn, conn:
        conn.execute(
            "UPDATE conversations SET user_id = ? WHERE id = ? AND user_id IS NULL", (user_id, conversation_id)
        )


def list_for_user(user_id: int) -> list[Summary]:
    """The user's conversations that have a document chosen, most recently updated first."""
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT id, document, fields, updated_at FROM conversations"
            " WHERE user_id = ? AND document IS NOT NULL ORDER BY updated_at DESC, rowid DESC",
            (user_id,),
        ).fetchall()
    return [
        Summary(
            id=row["id"],
            document=row["document"],
            document_name=DOCUMENTS[row["document"]].name,
            parties=_party_labels(json.loads(row["fields"])),
            updated_at=row["updated_at"],
        )
        for row in rows
    ]


def _party_labels(fields: dict[str, Any]) -> list[str]:
    """Each named party's company, else the signer's name."""
    parties = (fields["party1"], fields["party2"])
    return [label for party in parties if (label := party["company"] or party["name"])]


def _add_message(conn, conversation_id: str, message: Message) -> None:
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, message.role, message.content),
    )
