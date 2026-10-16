import pytest

CREDENTIALS = {"email": "a@example.com", "password": "secret"}


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("post", "/api/auth/signup", CREDENTIALS),
        ("post", "/api/auth/signin", CREDENTIALS),
        ("post", "/api/auth/signout", None),
        ("get", "/api/auth/me", None),
    ],
)
def test_auth_routes_are_placeholders(client, method, path, body):
    response = client.request(method, path, json=body)
    assert response.status_code == 501
    assert response.json() == {"detail": "Accounts are not available yet."}


@pytest.mark.parametrize("path", ["/api/auth/signup", "/api/auth/signin"])
def test_auth_routes_validate_credentials(client, path):
    response = client.post(path, json={"email": "a@example.com"})
    assert response.status_code == 422


def test_unknown_api_route_is_json_404(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
