from __future__ import annotations

from starlette.types import ASGIApp, Receive, Scope, Send


SENSITIVE_QUERY_PATHS = frozenset(
    {
        "/api/auth/callback",
        "/api/auth/sso-logout",
    }
)


class RedactSensitiveQueryMiddleware:
    """Hide OAuth secrets from an outer ASGI server's access-log scope."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        path = scope.get("path", "").rstrip("/")
        if (
            scope["type"] == "http"
            and path in SENSITIVE_QUERY_PATHS
            and scope.get("query_string")
        ):
            downstream_scope = dict(scope)
            scope["query_string"] = b""
            await self.app(downstream_scope, receive, send)
            return
        await self.app(scope, receive, send)
