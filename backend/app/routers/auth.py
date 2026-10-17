"""Auth API: sign up, sign in and out with an HttpOnly session cookie, and who is signed in."""

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from app import auth
from app.auth import SESSION_COOKIE, OptionalUser, SessionToken, User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class NewAccount(Credentials):
    password: str = Field(min_length=8, max_length=128)


def _start_session(response: Response, user: User) -> User:
    token = auth.create_session(user.id)
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", path="/")
    return user


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(account: NewAccount, response: Response) -> User:
    """Create an account and sign in to it."""
    user = auth.create_user(account.email, account.password)
    if user is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with that email already exists.")
    return _start_session(response, user)


@router.post("/signin")
def signin(credentials: Credentials, response: Response) -> User:
    """Sign in with email and password."""
    user = auth.authenticate(credentials.email, credentials.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    return _start_session(response, user)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(response: Response, session: SessionToken = None) -> None:
    """End the session, if any, and clear its cookie."""
    if session:
        auth.delete_session(session)
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me")
def me(user: OptionalUser) -> User | None:
    """The signed-in user, or null when signed out (signing in is optional)."""
    return user
