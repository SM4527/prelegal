"""Accounts and sessions: scrypt password hashes, and a random session token per sign-in kept in a cookie."""

import hashlib
import hmac
import secrets
import sqlite3
from contextlib import closing
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import connect

SESSION_COOKIE = "session"


class User(BaseModel):
    id: int
    email: str


def hash_password(password: str) -> str:
    """A salted scrypt hash, stored as "salt$key" in hex."""
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, key = stored.split("$")
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(candidate.hex(), key)


def _normalise(email: str) -> str:
    return email.strip().lower()


def create_user(email: str, password: str) -> User | None:
    """The new user, or None if the email is already registered."""
    email = _normalise(email)
    try:
        with closing(connect()) as conn, conn:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, hash_password(password))
            )
    except sqlite3.IntegrityError:
        return None
    return User(id=cursor.lastrowid, email=email)


def authenticate(email: str, password: str) -> User | None:
    """The user with this email and password, or None."""
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?", (_normalise(email),)
        ).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return User(id=row["id"], email=row["email"])


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with closing(connect()) as conn, conn:
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def delete_session(token: str) -> None:
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def optional_user(session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None) -> User | None:
    """The signed-in user, or None when signed out."""
    if session is None:
        return None
    with closing(connect()) as conn:
        row = conn.execute(
            "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ?",
            (session,),
        ).fetchone()
    return User(**row) if row else None


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    """The signed-in user; 401 when signed out."""
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in.")
    return user


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
