from __future__ import annotations

import base64
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.auth import AuthMeResponse, OAuthToken, SessionUser, UISUserInfo
from app.services.oauth_service import OAuthProviderError, UISOAuthClient


def auth_settings() -> Settings:
    return Settings(
        _env_file=None,
        uis_oauth_client_id="client-id",
        uis_oauth_client_secret="client-secret",
        uis_oauth_redirect_uri="https://lushangstudio.fudan.edu.cn/api/auth/callback",
        auth_session_secret="s" * 32,
    )


def oauth_client(
    handler: httpx.MockTransport,
) -> tuple[UISOAuthClient, httpx.AsyncClient]:
    http_client = httpx.AsyncClient(transport=handler)
    return UISOAuthClient(auth_settings(), http_client), http_client


def test_auth_settings_have_protocol_defaults_and_fail_closed_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "UIS_OAUTH_CLIENT_ID",
        "UIS_OAUTH_CLIENT_SECRET",
        "UIS_OAUTH_AUTHORIZATION_URL",
        "UIS_OAUTH_TOKEN_URL",
        "UIS_OAUTH_USER_INFO_URL",
        "UIS_OAUTH_LOGOUT_URL",
        "UIS_OAUTH_REDIRECT_URI",
        "AUTH_FRONTEND_URL",
        "AUTH_SESSION_SECRET",
        "AUTH_SESSION_COOKIE_NAME",
        "AUTH_SESSION_COOKIE_SECURE",
        "AUTH_SESSION_TTL_SECONDS",
        "AUTH_STATE_TTL_SECONDS",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = Settings(_env_file=None)

    assert settings.uis_oauth_authorization_url == (
        "https://id.fudan.edu.cn/idp/authCenter/authenticate"
    )
    assert settings.uis_oauth_token_url == "https://id.fudan.edu.cn/idp/api/v3/oauth2/token"
    assert settings.uis_oauth_user_info_url == (
        "https://id.fudan.edu.cn/idp/api/v3/oauth2/userInfo"
    )
    assert settings.uis_oauth_logout_url == "https://id.fudan.edu.cn/idp/authCenter/GLO"
    assert settings.uis_oauth_redirect_uri == (
        "https://lushangstudio.fudan.edu.cn/api/auth/callback"
    )
    assert settings.auth_frontend_url == "https://lushangstudio.fudan.edu.cn"
    assert settings.auth_session_cookie_name == "lushangstudio_session"
    assert settings.auth_session_cookie_secure is False
    assert settings.auth_session_ttl_seconds == 28_800
    assert settings.auth_state_ttl_seconds == 600
    assert settings.auth_configured is False
    assert auth_settings().auth_configured is True


def test_auth_settings_treat_whitespace_only_session_secret_as_unconfigured() -> None:
    settings = Settings(
        _env_file=None,
        uis_oauth_client_id="client-id",
        uis_oauth_client_secret="client-secret",
        auth_session_secret=" " * 32,
    )

    assert settings.auth_configured is False


def test_build_authorization_url_uses_exact_authorization_code_contract() -> None:
    client = UISOAuthClient(auth_settings())

    query = parse_qs(urlparse(client.build_authorization_url("state with spaces")).query)

    assert query == {
        "response_type": ["code"],
        "client_id": ["client-id"],
        "redirect_uri": ["https://lushangstudio.fudan.edu.cn/api/auth/callback"],
        "state": ["state with spaces"],
    }
    assert "code_challenge" not in query
    assert "code_challenge_method" not in query


@pytest.mark.asyncio
async def test_exchange_code_sends_basic_auth_and_only_required_form_fields() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        expected_credentials = base64.b64encode(b"client-id:client-secret").decode("ascii")
        assert request.method == "POST"
        assert request.url == httpx.URL(auth_settings().uis_oauth_token_url)
        assert request.headers["Authorization"] == f"Basic {expected_credentials}"
        assert request.headers["Content-Type"].startswith("application/x-www-form-urlencoded")
        assert request.content == b"grant_type=authorization_code&code=auth-code"
        return httpx.Response(200, json={"access_token": "access-token", "token_type": "Bearer"})

    client, http_client = oauth_client(httpx.MockTransport(handler))
    async with http_client:
        token = await client.exchange_code("auth-code")

    assert token.access_token == "access-token"
    assert token.token_type == "Bearer"


@pytest.mark.asyncio
async def test_fetch_user_info_uses_bearer_auth_and_strict_documented_fields() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert request.url == httpx.URL(auth_settings().uis_oauth_user_info_url)
        assert request.headers["Authorization"] == "Bearer access-token"
        return httpx.Response(
            200,
            json={
                "user_id": "01234567890",
                "user_name": "Test User",
                "user_type": "研究生",
                "sessionId": "uis-session",
                "mobile": "13800000000",
                "email": "user@example.edu.cn",
                "department": "Example Department",
            },
        )

    client, http_client = oauth_client(httpx.MockTransport(handler))
    async with http_client:
        user = await client.fetch_user_info("access-token")

    assert user == UISUserInfo(
        user_id="01234567890",
        user_name="Test User",
        user_type="研究生",
        sessionId="uis-session",
        mobile="13800000000",
        email="user@example.edu.cn",
        department="Example Department",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"user_name": "Test User", "user_type": "研究生", "sessionId": "uis-session"},
        {
            "userId": "01234567890",
            "userName": "Test User",
            "user_type": "研究生",
            "sessionId": "uis-session",
        },
        {
            "user_id": "01234567890",
            "user_name": "Test User",
            "user_type": "研究生",
            "sessionId": 123,
        },
    ],
)
async def test_fetch_user_info_rejects_missing_alternative_or_mistyped_fields(
    payload: dict[str, object],
) -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client, http_client = oauth_client(httpx.MockTransport(handler))
    async with http_client:
        with pytest.raises(OAuthProviderError, match="invalid user info response"):
            await client.fetch_user_info("access-token")


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["token", "user_info"])
@pytest.mark.parametrize("errcode", ["invalid_grant", 0])
async def test_provider_errcode_in_http_200_response_is_an_oauth_failure(
    operation: str,
    errcode: str | int,
) -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"errcode": errcode, "errmsg": "provider detail"})

    client, http_client = oauth_client(httpx.MockTransport(handler))
    async with http_client:
        with pytest.raises(OAuthProviderError) as error:
            if operation == "token":
                await client.exchange_code("secret-code")
            else:
                await client.fetch_user_info("secret-token")

    assert error.value.operation == operation
    assert error.value.errcode == errcode
    assert "provider detail" not in str(error.value)
    assert "secret-" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [400, 500])
async def test_provider_http_errors_are_normalized_without_response_secrets(
    status_code: int,
) -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"access_token": "leaked-token"})

    client, http_client = oauth_client(httpx.MockTransport(handler))
    async with http_client:
        with pytest.raises(OAuthProviderError) as error:
            await client.exchange_code("secret-code")

    assert error.value.status_code == status_code
    assert "leaked-token" not in str(error.value)
    assert "secret-code" not in str(error.value)


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["token", "user_info"])
async def test_transport_errors_are_normalized_without_request_secrets(operation: str) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        leaked_details = f"{request.url} {dict(request.headers)} {request.content!r}"
        raise httpx.ConnectError(leaked_details, request=request)

    settings = auth_settings().model_copy(
        update={
            "uis_oauth_token_url": "https://provider.example/token?query=query-secret",
            "uis_oauth_user_info_url": "https://provider.example/user?query=query-secret",
        }
    )
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = UISOAuthClient(settings, http_client)

    async with http_client:
        with pytest.raises(OAuthProviderError) as error:
            if operation == "token":
                await client.exchange_code("secret-code")
            else:
                await client.fetch_user_info("secret-token")

    message = str(error.value)
    assert error.value.operation == operation
    assert error.value.status_code is None
    assert "provider.example" not in message
    assert "query-secret" not in message
    assert "client-secret" not in message
    assert "Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ=" not in message
    assert "secret-code" not in message
    assert "secret-token" not in message


def test_auth_response_models_forbid_undeclared_or_mistyped_session_data() -> None:
    user = SessionUser(user_id="01234567890", user_name="Test User", user_type="研究生")

    assert AuthMeResponse(authenticated=True, user=user).user == user
    with pytest.raises(ValidationError):
        SessionUser(user_id="01234567890", user_name="Test User", user_type="研究生", mobile="x")
    with pytest.raises(ValidationError):
        AuthMeResponse(authenticated=True, user=None)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("user_id", ""),
        ("user_name", "   "),
        ("user_type", "\t"),
        ("sessionId", "\r\n"),
    ],
)
def test_required_uis_identity_fields_reject_blank_values(
    field: str,
    value: str,
) -> None:
    payload = {
        "user_id": "01234567890",
        "user_name": "Test User",
        "user_type": "研究生",
        "sessionId": "uis-session",
    }
    payload[field] = value

    with pytest.raises(ValidationError):
        UISUserInfo.model_validate(payload)


def test_required_auth_strings_are_trimmed() -> None:
    user = UISUserInfo(
        user_id=" 01234567890 ",
        user_name=" Test User ",
        user_type=" 本专科生 ",
        sessionId=" uis-session ",
    )

    assert user.user_id == "01234567890"
    assert user.user_name == "Test User"
    assert user.user_type == "本专科生"
    assert user.sessionId == "uis-session"


@pytest.mark.parametrize("access_token", ["", "   "])
def test_oauth_token_rejects_blank_access_token(access_token: str) -> None:
    with pytest.raises(ValidationError):
        OAuthToken(access_token=access_token)


def test_oauth_token_rejects_negative_expiry() -> None:
    with pytest.raises(ValidationError):
        OAuthToken(access_token="access-token", expires_in=-1)
