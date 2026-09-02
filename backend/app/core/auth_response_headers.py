from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send


AUTH_PATH_PREFIX = "/api/auth/"
AUTH_CALLBACK_PATH = "/api/auth/callback"


class AuthResponseSecurityHeadersMiddleware:
    """Apply non-cacheable auth response headers at the outer ASGI boundary."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith(AUTH_PATH_PREFIX):
            await self.app(scope, receive, send)
            return

        is_callback = path.rstrip("/") == AUTH_CALLBACK_PATH

        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"cache-control"
                ]
                headers.append((b"cache-control", b"no-store"))
                if is_callback:
                    headers = [
                        (name, value)
                        for name, value in headers
                        if name.lower() != b"referrer-policy"
                    ]
                    headers.append((b"referrer-policy", b"no-referrer"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_security_headers)
