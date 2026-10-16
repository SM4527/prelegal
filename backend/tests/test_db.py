import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.db import db_path, init_db
from app.main import app


def query(sql: str, params: tuple = ()) -> list[tuple]:
    with closing(sqlite3.connect(db_path())) as conn, conn:
        return conn.execute(sql, params).fetchall()


def add_user(email: str) -> None:
    query("INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, "hash"))


def test_startup_creates_users_table(client):
    columns = [row[1] for row in query("PRAGMA table_info(users)")]
    assert columns == ["id", "email", "password_hash", "created_at"]


def test_new_user_gets_id_and_timestamp(client):
    add_user("a@example.com")
    [(user_id, created_at)] = query("SELECT id, created_at FROM users")
    assert user_id == 1
    assert created_at


def test_email_must_be_unique(client):
    add_user("a@example.com")
    with pytest.raises(sqlite3.IntegrityError):
        add_user("a@example.com")


def test_init_db_starts_from_scratch(client):
    add_user("a@example.com")
    init_db()
    assert query("SELECT * FROM users") == []


def test_each_app_start_has_empty_database():
    with TestClient(app):
        add_user("a@example.com")
    with TestClient(app):
        assert query("SELECT * FROM users") == []
