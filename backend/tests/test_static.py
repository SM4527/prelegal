import pytest


@pytest.mark.parametrize(
    ("path", "title"),
    [("/", "Home"), ("/signin/", "Sign in"), ("/signup/", "Sign up"), ("/documents/", "My documents")],
)
def test_serves_frontend_pages(client, path, title):
    response = client.get(path)
    assert response.status_code == 200
    assert f"<title>{title}</title>" in response.text


def test_redirects_to_trailing_slash(client):
    response = client.get("/signin", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].endswith("/signin/")


def test_unknown_page_is_404(client):
    assert client.get("/nope/").status_code == 404
