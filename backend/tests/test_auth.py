from __future__ import annotations

import base64
import hmac
import json
from urllib.parse import parse_qs, quote, urlparse

import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.routes import auth as auth_routes
from app.core.config import Settings
from app.main import create_app
from app.schemas.auth import OAuthToken, UISUserInfo
from app.services.oauth_service import OAuthProviderError


def configured_settings(**updates: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "app_env": "test",
        "uis_oauth_client_id": "client-id",
        "uis_oauth_client_secret": "client-secret",
        "uis_oauth_authorization_url": "https://uis.example/authorize",
        "uis_oauth_token_url": "https://uis.example/token",
        "uis_oauth_user_info_url": "https://uis.example/user-info",
        "uis_oauth_logout_url": "https://uis.example/GLO",
        "uis_oauth_redirect_uri": "https://app.example/api/auth/callback",
        "auth_frontend_url": "https://app.example",
        "auth_session_secret": "s" * 32,
        "auth_session_cookie_name": "test_session",
        "auth_session_cookie_secure": False,
        "auth_session_ttl_seconds": 28_800,
        "auth_state_ttl_seconds": 600,
    }
    values.update(updates)
    return Settings(**values)


class FakeUISOAuthClient:
    def __init__(self, *, user_type: str = "研究生") -> None:
        self.user_type = user_type
        self.exchanged_codes: list[str] = []
        self.fetched_tokens: list[str] = []

    def build_authorization_url(self, state: str) -> str:
        return f"https://uis.example/authorize?state={quote(state)}"

    async def exchange_code(self, code: str) -> OAuthToken:
        self.exchanged_codes.append(code)
        return OAuthToken(
            access_token="provider-access-token",
            refresh_token="provider-refresh-token",
            token_type="Bearer",
        )

    async def fetch_user_info(self, access_token: str) -> UISUserInfo:
        self.fetched_tokens.append(access_token)
        return UISUserInfo(
            user_id="01234567890",
            user_name="Test User",
            user_type=self.user_type,
            sessionId="uis-session",
            mobile="13800000000",
            email="user@example.edu.cn",
            department="Example Department",
        )


class AccessLogScopeProbe:
    """Observe the request scope at the point an outer ASGI server logs it."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.query_strings: list[bytes] = []

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        async def send_wrapper(message: Message) -> None:
            if scope["type"] == "http" and message["type"] == "http.response.start":
                self.query_strings.append(scope["query_string"])
            await send(message)

        await self.app(scope, receive, send_wrapper)


def assert_query_hidden_from_access_log(
    probe: AccessLogScopeProbe,
    route_name: str,
) -> None:
    if probe.query_strings != [b""]:
        raise AssertionError(f"{route_name} query reached the access-log scope")


def make_client(
    fake_oauth: FakeUISOAuthClient | None = None,
    settings: Settings | None = None,
) -> tuple[TestClient, FakeUISOAuthClient, Settings]:
    actual_settings = settings or configured_settings()
    fake = fake_oauth or FakeUISOAuthClient()
    app = create_app(actual_settings)
    app.dependency_overrides[auth_routes.get_uis_oauth_client] = lambda: fake
    return TestClient(app, follow_redirects=False), fake, actual_settings


def begin_login(client: TestClient) -> str:
    response = client.get("/api/auth/login")
    assert response.status_code == 302
    return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


def complete_login(client: TestClient) -> None:
    state = begin_login(client)
    response = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": state},
    )
    assert response.status_code == 303


def assert_auth_security_headers(response: object) -> None:
    assert getattr(response, "headers")["cache-control"] == "no-store"
    assert getattr(response, "headers").get("referrer-policy") == "no-referrer"


def decode_session_cookie(client: TestClient, settings: Settings) -> dict[str, object]:
    cookie = client.cookies.get(settings.auth_session_cookie_name)
    assert cookie is not None
    signed_payload = TimestampSigner(settings.auth_session_secret).unsign(cookie.encode())
    return json.loads(base64.b64decode(signed_payload))


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/documents/extract"),
        ("post", "/api/documents/parse"),
        ("post", "/api/filters/classify"),
        ("post", "/api/notices/generate"),
        ("post", "/api/exports/xlsx"),
    ],
)
def test_each_business_endpoint_group_rejects_anonymous_requests(
    anonymous_client: TestClient, method: str, path: str
) -> None:
    response = anonymous_client.request(method, path)

    assert response.status_code == 401
    assert response.json() == {"detail": "Not authenticated"}


def test_health_and_auth_routes_remain_public() -> None:
    client, _, _ = make_client()

    assert client.get("/api/health").status_code == 200
    assert client.get("/api/auth/me").json() == {
        "authenticated": False,
        "user": None,
    }


def test_login_redirect_creates_state_and_secure_cookie_attributes() -> None:
    client, _, _ = make_client()

    response = client.get("/api/auth/login")

    assert response.status_code == 302
    state = parse_qs(urlparse(response.headers["location"]).query)["state"][0]
    assert len(state) >= 32
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "max-age=28800" in set_cookie


def test_auth_public_responses_disable_caching() -> None:
    client, _, _ = make_client()

    for response in (
        client.get("/api/auth/login"),
        client.get("/api/auth/me"),
        client.get("/api/auth/sso-logout"),
    ):
        assert response.headers["cache-control"] == "no-store"


def test_callback_success_and_http_error_disable_caching_and_referrers() -> None:
    client, _, _ = make_client()
    state = begin_login(client)

    success = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": state},
    )
    assert_auth_security_headers(success)

    invalid_state = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": "invalid-state"},
    )
    assert invalid_state.status_code == 400
    assert_auth_security_headers(invalid_state)


def test_callback_provider_error_disables_caching_and_referrers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, fake, _ = make_client()
    state = begin_login(client)

    async def reject_code(_: str) -> OAuthToken:
        raise OAuthProviderError("provider unavailable")

    monkeypatch.setattr(fake, "exchange_code", reject_code)
    response = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": state},
    )

    assert response.status_code == 502
    assert_auth_security_headers(response)


def test_callback_validation_and_trailing_slash_redirect_disable_caching_and_referrers() -> None:
    client, _, _ = make_client()

    validation_error = client.get("/api/auth/callback")
    assert validation_error.status_code == 422
    assert_auth_security_headers(validation_error)

    trailing_slash = client.get(
        "/api/auth/callback/",
        params={"code": "unexpected-sensitive-code", "state": "unexpected-sensitive-state"},
    )
    assert trailing_slash.status_code == 307
    assert_auth_security_headers(trailing_slash)


def test_production_session_cookie_is_always_secure() -> None:
    client, _, _ = make_client(
        settings=configured_settings(
            app_env="production",
            auth_session_cookie_secure=False,
        )
    )

    response = client.get("/api/auth/login")

    assert "; secure" in response.headers["set-cookie"].lower()


@pytest.mark.parametrize("state_mode", ["missing", "wrong"])
def test_callback_rejects_missing_or_wrong_state_without_oauth_calls(
    state_mode: str,
) -> None:
    client, fake, _ = make_client()
    begin_login(client)
    params = {"code": "secret-code"}
    if state_mode == "wrong":
        params["state"] = "wrong-state"

    response = client.get("/api/auth/callback", params=params)

    assert response.status_code == 400
    assert fake.exchanged_codes == []
    assert fake.fetched_tokens == []


def test_callback_rejects_expired_state_without_oauth_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, fake, settings = make_client()
    monkeypatch.setattr(auth_routes.time, "time", lambda: 1_000)
    state = begin_login(client)
    monkeypatch.setattr(
        auth_routes.time,
        "time",
        lambda: 1_000 + settings.auth_state_ttl_seconds + 1,
    )

    response = client.get(
        "/api/auth/callback",
        params={"code": "secret-code", "state": state},
    )

    assert response.status_code == 400
    assert fake.exchanged_codes == []
    assert fake.fetched_tokens == []


def test_callback_state_is_single_use() -> None:
    client, fake, _ = make_client()
    state = begin_login(client)

    first = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": state},
    )
    replay = client.get(
        "/api/auth/callback",
        params={"code": "replayed-code", "state": state},
    )

    assert first.status_code == 303
    assert replay.status_code == 400
    assert fake.exchanged_codes == ["authorization-code"]


def test_successful_callback_stores_only_minimal_signed_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, fake, settings = make_client()
    monkeypatch.setattr(auth_routes.time, "time", lambda: 1_000)

    complete_login(client)

    assert fake.exchanged_codes == ["authorization-code"]
    assert fake.fetched_tokens == ["provider-access-token"]
    assert client.get("/api/auth/me").json() == {
        "authenticated": True,
        "user": {
            "user_id": "01234567890",
            "user_name": "Test User",
            "user_type": "研究生",
        },
    }
    assert decode_session_cookie(client, settings) == {
        "user": {
            "user_id": "01234567890",
            "user_name": "Test User",
            "user_type": "研究生",
        },
        "authenticated_at": 1_000,
    }


def test_whitespace_padded_undergraduate_type_is_blocked_without_a_session() -> None:
    client, fake, settings = make_client(FakeUISOAuthClient(user_type=" 本专科生 "))
    state = begin_login(client)

    response = client.get(
        "/api/auth/callback",
        params={"code": "authorization-code", "state": state},
    )

    assert response.status_code == 303
    location = urlparse(response.headers["location"])
    assert (location.scheme, location.netloc) == ("https", "app.example")
    assert parse_qs(location.query) == {
        "auth_error": ["undergraduate_not_allowed"]
    }
    assert fake.exchanged_codes == ["authorization-code"]
    assert fake.fetched_tokens == ["provider-access-token"]
    assert client.get("/api/auth/me").json()["authenticated"] is False
    assert client.cookies.get(settings.auth_session_cookie_name) is None


def test_active_logout_clears_session_and_uses_only_fixed_redirect() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.post(
        "/api/auth/logout",
        params={"return_url": "https://attacker.example/steal"},
        headers={"origin": "https://app.example"},
    )

    assert response.status_code == 303
    assert response.headers["cache-control"] == "no-store"
    location = urlparse(response.headers["location"])
    assert (location.scheme, location.netloc, location.path) == (
        "https",
        "uis.example",
        "/GLO",
    )
    assert parse_qs(location.query) == {
        "redirectToLogin": ["true"],
        "redirectToUrl": ["https://app.example"],
    }
    assert "attacker.example" not in response.headers["location"]
    assert client.get("/api/auth/me").json()["authenticated"] is False


def test_active_logout_accepts_same_origin_referer_when_origin_is_absent() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.post(
        "/api/auth/logout",
        headers={"referer": "https://app.example/workbench?tab=exports"},
    )

    assert response.status_code == 303
    assert client.get("/api/auth/me").json()["authenticated"] is False


@pytest.mark.parametrize(
    "headers",
    [
        {"origin": "https://attacker.example"},
        {"origin": "not a valid origin"},
        {},
    ],
)
def test_active_logout_rejects_untrusted_browser_sources_without_clearing_session(
    headers: dict[str, str],
) -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.post("/api/auth/logout", headers=headers)

    assert response.status_code == 403
    assert "location" not in response.headers
    assert client.get("/api/auth/me").json()["authenticated"] is True


def test_active_logout_rejects_anonymous_same_origin_request_without_redirecting() -> None:
    client, _, _ = make_client()

    response = client.post(
        "/api/auth/logout",
        headers={"origin": "https://app.example"},
    )

    assert response.status_code == 401
    assert "location" not in response.headers


def test_callback_login_reaches_protected_xlsx_export_with_real_session() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.post(
        "/api/exports/xlsx",
        json={
            "source_document": "source.docx",
            "items": [{"number": 1, "summary": "Test", "content": "Export row"}],
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.content[:2] == b"PK"


def test_frontend_passive_logout_clears_current_session_without_a_token() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.get("/api/auth/sso-logout")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/auth/me").json()["authenticated"] is False


def test_unexpected_sensitive_queries_are_defensively_hidden_from_access_logs() -> None:
    settings = configured_settings()
    fake = FakeUISOAuthClient()
    application = create_app(settings)
    application.dependency_overrides[auth_routes.get_uis_oauth_client] = lambda: fake
    access_log_probe = AccessLogScopeProbe(application)
    client = TestClient(access_log_probe, follow_redirects=False)

    state = begin_login(client)
    access_log_probe.query_strings.clear()
    callback_code = "synthetic-callback-code"
    callback = client.get(
        "/api/auth/callback",
        params={"code": callback_code, "state": state},
    )

    assert callback.status_code == 303
    assert len(fake.exchanged_codes) == 1
    assert hmac.compare_digest(fake.exchanged_codes[0], callback_code)
    assert_query_hidden_from_access_log(access_log_probe, "OAuth callback")

    access_log_probe.query_strings.clear()
    # Pure front-end logout has no query. This unexpected value proves that any
    # sensitive query arriving at the endpoint is still redacted defensively.
    passive_logout = client.get(
        "/api/auth/sso-logout",
        params={"token": "unexpected-sensitive-value"},
    )

    assert passive_logout.status_code == 204
    assert_query_hidden_from_access_log(access_log_probe, "passive logout")
    assert client.get("/api/auth/me").json()["authenticated"] is False

    access_log_probe.query_strings.clear()
    health = client.get("/api/health", params={"verbose": "true"})

    assert health.status_code == 200
    assert access_log_probe.query_strings == [b"verbose=true"]


@pytest.mark.parametrize(
    ("path", "params", "expected_query", "route_name"),
    [
        (
            "/api/auth/callback/",
            {"code": "synthetic-code", "state": "synthetic-state"},
            {"code": ["synthetic-code"], "state": ["synthetic-state"]},
            "trailing-slash OAuth callback",
        ),
        (
            "/api/auth/sso-logout/",
            {"token": "unexpected-sensitive-value"},
            {"token": ["unexpected-sensitive-value"]},
            "trailing-slash passive logout defensive redaction",
        ),
    ],
)
def test_trailing_slash_sensitive_queries_are_hidden_before_route_redirect(
    path: str,
    params: dict[str, str],
    expected_query: dict[str, list[str]],
    route_name: str,
) -> None:
    # Pure front-end logout has no query. The passive-logout case below keeps
    # an explicitly unexpected sensitive value solely for defense-in-depth.
    application = create_app(configured_settings())
    access_log_probe = AccessLogScopeProbe(application)
    client = TestClient(access_log_probe, follow_redirects=False)

    response = client.get(path, params=params)

    assert response.status_code == 307
    assert parse_qs(urlparse(response.headers["location"]).query) == expected_query
    assert_query_hidden_from_access_log(access_log_probe, route_name)


def test_auth_misconfiguration_returns_503_and_business_routes_fail_closed() -> None:
    settings = Settings(
        _env_file=None,
        uis_oauth_client_id="",
        uis_oauth_client_secret="",
        auth_session_secret="short",
    )
    app = create_app(settings)
    client = TestClient(app, follow_redirects=False)

    assert client.get("/api/auth/login").status_code == 503
    assert client.post("/api/documents/extract").status_code == 503
    assert client.get("/api/health").status_code == 200
