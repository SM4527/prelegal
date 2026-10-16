from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}
