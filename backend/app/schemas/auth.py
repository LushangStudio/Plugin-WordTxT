from __future__ import annotations

from pydantic import BaseModel, ConfigDict, model_validator


class StrictAuthModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class UISUserInfo(StrictAuthModel):
    user_id: str
    user_name: str
    user_type: str
    sessionId: str
    mobile: str | None = None
    email: str | None = None
    department: str | None = None


class SessionUser(StrictAuthModel):
    user_id: str
    user_name: str
    user_type: str


class AuthMeResponse(StrictAuthModel):
    authenticated: bool
    user: SessionUser | None = None

    @model_validator(mode="after")
    def require_user_when_authenticated(self) -> AuthMeResponse:
        if self.authenticated and self.user is None:
            raise ValueError("authenticated responses require a user")
        if not self.authenticated and self.user is not None:
            raise ValueError("anonymous responses cannot include a user")
        return self


class OAuthToken(StrictAuthModel):
    access_token: str
    token_type: str | None = None
    expires_in: int | None = None
    refresh_token: str | None = None
    scope: str | None = None
