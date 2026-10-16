"""Storage for chat conversations: the NDA fields so far and the message history."""

from contextlib import closing
from dataclasses import dataclass
from uuid import uuid4

from app.db import connect
from app.nda import NdaFields


@dataclass
class Conversation:
    id: str
    fields: NdaFields
    messages: list[dict[str, str]]


def create(fields: NdaFields, greeting: str) -> str:
    """Store a new conversation that opens with the assistant's greeting; return its id."""
    conversation_id = uuid4().hex
    with closing(connect()) as conn, conn:
        conn.execute(
            "INSERT INTO conversations (id, fields) VALUES (?, ?)",
            (conversation_id, fields.model_dump_json(by_alias=True)),
        )
        _add_message(conn, conversation_id, "assistant", greeting)
    return conversation_id


def get(conversation_id: str) -> Conversation | None:
    with closing(connect()) as conn:
        row = conn.execute("SELECT fields FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        if row is None:
            return None
        messages = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,)
        ).fetchall()
    return Conversation(conversation_id, NdaFields.model_validate_json(row["fields"]), [dict(m) for m in messages])


def add_turn(conversation_id: str, user_text: str, reply: str, fields: NdaFields) -> None:
    """Store a user message, the assistant's reply and the updated fields in one transaction."""
    with closing(connect()) as conn, conn:
        _add_message(conn, conversation_id, "user", user_text)
        _add_message(conn, conversation_id, "assistant", reply)
        conn.execute(
            "UPDATE conversations SET fields = ? WHERE id = ?",
            (fields.model_dump_json(by_alias=True), conversation_id),
        )


def _add_message(conn, conversation_id: str, role: str, content: str) -> None:
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)", (conversation_id, role, content)
    )
