from __future__ import annotations

import base64
import hashlib
import json
from urllib.parse import parse_qs, quote, urlparse

import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner

from app.api.routes import auth as auth_routes
from app.core.config import Settings
from app.main import create_app
from app.schemas.auth import OAuthToken, UISUserInfo


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
        "access_token_sha256": hashlib.sha256(
            b"provider-access-token"
        ).hexdigest(),
    }


def test_exact_undergraduate_type_is_blocked_without_a_session() -> None:
    client, fake, settings = make_client(FakeUISOAuthClient(user_type="本专科生"))
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
    )

    assert response.status_code == 303
    location = urlparse(response.headers["location"])
    assert (location.scheme, location.netloc, location.path) == (
        "https",
        "uis.example",
        "/GLO",
    )
    assert parse_qs(location.query) == {
        "redirectToUrl": ["https://app.example"]
    }
    assert "attacker.example" not in response.headers["location"]
    assert client.get("/api/auth/me").json()["authenticated"] is False


def test_mismatching_passive_logout_token_keeps_current_session() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.get(
        "/api/auth/sso-logout",
        params={"token": "a-different-token"},
    )

    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/auth/me").json()["authenticated"] is True


def test_matching_passive_logout_token_clears_current_session() -> None:
    client, _, _ = make_client()
    complete_login(client)

    response = client.get(
        "/api/auth/sso-logout",
        params={"token": "provider-access-token"},
    )

    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/auth/me").json()["authenticated"] is False


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
