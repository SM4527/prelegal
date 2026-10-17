import pytest

from conftest import PASSWORD, sign_up
from test_db import query


def test_signup_creates_the_account_and_signs_in(client):
    response = sign_up(client, "a@example.com")

    assert response.status_code == 201
    assert response.json() == {"id": 1, "email": "a@example.com"}
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").json() == {"id": 1, "email": "a@example.com"}


def test_password_is_stored_hashed(client):
    sign_up(client, "a@example.com")
    [(password_hash,)] = query("SELECT password_hash FROM users")
    assert PASSWORD not in password_hash


def test_signup_rejects_a_taken_email_in_any_case(client):
    sign_up(client, "a@example.com")
    response = sign_up(client, " A@Example.com ")
    assert response.status_code == 409
    assert response.json() == {"detail": "An account with that email already exists."}


def test_signup_requires_eight_character_password(client):
    response = client.post("/api/auth/signup", json={"email": "a@example.com", "password": "short"})
    assert response.status_code == 422


@pytest.mark.parametrize("path", ["/api/auth/signup", "/api/auth/signin"])
def test_auth_routes_validate_credentials(client, path):
    response = client.post(path, json={"email": "a@example.com"})
    assert response.status_code == 422


def test_signin_with_the_right_password(client):
    sign_up(client, "a@example.com")
    client.cookies.clear()

    response = client.post("/api/auth/signin", json={"email": "A@example.com", "password": PASSWORD})

    assert response.status_code == 200
    assert response.json()["email"] == "a@example.com"
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("email, password", [("a@example.com", "wrong-password"), ("b@example.com", PASSWORD)])
def test_signin_rejects_wrong_credentials(client, email, password):
    sign_up(client, "a@example.com")
    client.cookies.clear()

    response = client.post("/api/auth/signin", json={"email": email, "password": password})

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}


def test_me_is_401_when_signed_out(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in."}


def test_signout_ends_the_session(client):
    sign_up(client, "a@example.com")
    token = client.cookies["session"]

    assert client.post("/api/auth/signout").status_code == 204

    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("session", token)
    assert client.get("/api/auth/me").status_code == 401


def test_signout_when_signed_out(client):
    assert client.post("/api/auth/signout").status_code == 204
