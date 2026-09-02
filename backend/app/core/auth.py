from __future__ import annotations

import time

from fastapi import Depends, HTTPException, Request, status
from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.schemas.auth import SessionUser


USER_SESSION_KEY = "user"
AUTHENTICATED_AT_SESSION_KEY = "authenticated_at"


def read_session_user(request: Request) -> SessionUser | None:
    payload = request.session.get(USER_SESSION_KEY)
    if payload is None:
        return None
    try:
        return SessionUser.model_validate(payload)
    except ValidationError:
        request.session.clear()
        return None


def establish_session(request: Request, user: SessionUser) -> None:
    request.session.clear()
    request.session.update(
        {
            USER_SESSION_KEY: user.model_dump(),
            AUTHENTICATED_AT_SESSION_KEY: int(time.time()),
        }
    )


def require_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SessionUser:
    if not settings.auth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        )
    user = read_session_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user
