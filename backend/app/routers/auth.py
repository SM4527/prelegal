"""Auth API. Placeholder: every route responds 501 until real auth is built."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: str
    password: str


def not_implemented() -> HTTPException:
    return HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Accounts are not available yet.")


@router.post("/signup")
def signup(credentials: Credentials):
    """Create a user account."""
    raise not_implemented()


@router.post("/signin")
def signin(credentials: Credentials):
    """Sign in with email and password."""
    raise not_implemented()


@router.post("/signout")
def signout():
    """Sign out the current user."""
    raise not_implemented()


@router.get("/me")
def me():
    """Return the signed-in user."""
    raise not_implemented()
