from __future__ import annotations

import hmac
import secrets
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from app.core.auth import (
    establish_session,
    read_session_user,
)
from app.core.config import Settings, get_settings
from app.schemas.auth import AuthMeResponse, SessionUser
from app.services.oauth_service import OAuthProviderError, UISOAuthClient


router = APIRouter()
OAUTH_STATE_SESSION_KEY = "oauth_state"


def get_uis_oauth_client(
    settings: Settings = Depends(get_settings),
) -> UISOAuthClient:
    return UISOAuthClient(settings)


def _require_auth_configuration(settings: Settings) -> None:
    if not settings.auth_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        )


def _fixed_url_with_query(url: str, **params: str) -> str:
    return str(httpx.URL(url).copy_merge_params(params))


@router.get("/login")
def login(
    request: Request,
    settings: Settings = Depends(get_settings),
    oauth_client: UISOAuthClient = Depends(get_uis_oauth_client),
) -> RedirectResponse:
    _require_auth_configuration(settings)
    state_value = secrets.token_urlsafe(32)
    request.session[OAUTH_STATE_SESSION_KEY] = {
        "value": state_value,
        "issued_at": time.time(),
    }
    return RedirectResponse(
        oauth_client.build_authorization_url(state_value),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/callback")
async def callback(
    request: Request,
    code: str,
    state: str | None = None,
    settings: Settings = Depends(get_settings),
    oauth_client: UISOAuthClient = Depends(get_uis_oauth_client),
) -> RedirectResponse:
    _require_auth_configuration(settings)
    stored_state = request.session.pop(OAUTH_STATE_SESSION_KEY, None)
    now = time.time()
    valid_state = (
        isinstance(stored_state, dict)
        and isinstance(stored_state.get("value"), str)
        and isinstance(stored_state.get("issued_at"), (int, float))
        and not isinstance(stored_state.get("issued_at"), bool)
        and isinstance(state, str)
        and hmac.compare_digest(stored_state["value"], state)
        and 0 <= now - stored_state["issued_at"] <= settings.auth_state_ttl_seconds
    )
    if not valid_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )

    try:
        token = await oauth_client.exchange_code(code)
        user_info = await oauth_client.fetch_user_info(token.access_token)
    except OAuthProviderError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="UIS authentication failed",
        ) from None

    if user_info.user_type == "本专科生":
        request.session.clear()
        return RedirectResponse(
            _fixed_url_with_query(
                settings.auth_frontend_url,
                auth_error="undergraduate_not_allowed",
            ),
            status_code=status.HTTP_303_SEE_OTHER,
        )

    establish_session(
        request,
        SessionUser(
            user_id=user_info.user_id,
            user_name=user_info.user_name,
            user_type=user_info.user_type,
        ),
    )
    return RedirectResponse(
        settings.auth_frontend_url,
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/me", response_model=AuthMeResponse)
def me(request: Request) -> AuthMeResponse:
    user = read_session_user(request)
    return AuthMeResponse(authenticated=user is not None, user=user)


@router.post("/logout")
def logout(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    request.session.clear()
    return RedirectResponse(
        _fixed_url_with_query(
            settings.uis_oauth_logout_url,
            redirectToLogin="true",
            redirectToUrl=settings.auth_frontend_url,
        ),
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/sso-logout", status_code=status.HTTP_204_NO_CONTENT)
def sso_logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
