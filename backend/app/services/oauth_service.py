from __future__ import annotations

from typing import Any

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.auth import OAuthToken, UISUserInfo


class OAuthProviderError(RuntimeError):
    def __init__(
        self,
        operation: str,
        *,
        status_code: int | None = None,
        errcode: str | int | None = None,
        reason: str | None = None,
    ) -> None:
        self.operation = operation
        self.status_code = status_code
        self.errcode = errcode
        self.reason = reason

        parts = [f"UIS OAuth {operation} failed"]
        if status_code is not None:
            parts.append(f"HTTP {status_code}")
        if errcode is not None:
            parts.append(f"errcode {errcode}")
        if reason is not None:
            parts.append(reason)
        super().__init__(": ".join(parts))


class UISOAuthClient:
    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings
        self._client = client

    def build_authorization_url(self, state: str) -> str:
        return str(
            httpx.URL(self.settings.uis_oauth_authorization_url).copy_merge_params(
                {
                    "response_type": "code",
                    "client_id": self.settings.uis_oauth_client_id,
                    "redirect_uri": self.settings.uis_oauth_redirect_uri,
                    "state": state,
                }
            )
        )

    async def exchange_code(self, code: str) -> OAuthToken:
        response = await self._request(
            "POST",
            self.settings.uis_oauth_token_url,
            auth=httpx.BasicAuth(
                self.settings.uis_oauth_client_id,
                self.settings.uis_oauth_client_secret,
            ),
            data={"grant_type": "authorization_code", "code": code},
        )
        data = self._response_data(response, "token")
        try:
            return OAuthToken.model_validate(data)
        except ValidationError as exc:
            raise OAuthProviderError("token", reason="invalid token response") from exc

    async def fetch_user_info(self, access_token: str) -> UISUserInfo:
        response = await self._request(
            "GET",
            self.settings.uis_oauth_user_info_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        data = self._response_data(response, "user_info")
        try:
            return UISUserInfo.model_validate(data)
        except ValidationError as exc:
            raise OAuthProviderError("user_info", reason="invalid user info response") from exc

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        if self._client is not None:
            return await self._client.request(method, url, **kwargs)
        async with httpx.AsyncClient() as client:
            return await client.request(method, url, **kwargs)

    @staticmethod
    def _response_data(response: httpx.Response, operation: str) -> dict[str, Any]:
        if not response.is_success:
            raise OAuthProviderError(operation, status_code=response.status_code)
        try:
            data = response.json()
        except ValueError as exc:
            raise OAuthProviderError(operation, reason="invalid JSON response") from exc
        if not isinstance(data, dict):
            raise OAuthProviderError(operation, reason="invalid JSON response")

        if "errcode" in data:
            raise OAuthProviderError(
                operation,
                status_code=response.status_code,
                errcode=data["errcode"],
            )
        return data
