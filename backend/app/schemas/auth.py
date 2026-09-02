from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator


NonEmptyString = Annotated[str, Field(min_length=1)]


class StrictAuthModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        str_strip_whitespace=True,
    )


class UISUserInfo(StrictAuthModel):
    user_id: NonEmptyString
    user_name: NonEmptyString
    user_type: NonEmptyString
    sessionId: NonEmptyString
    mobile: str | None = None
    email: str | None = None
    department: str | None = None


class SessionUser(StrictAuthModel):
    user_id: NonEmptyString
    user_name: NonEmptyString
    user_type: NonEmptyString


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
    access_token: NonEmptyString
    token_type: str | None = None
    expires_in: int | None = Field(default=None, ge=0)
    refresh_token: str | None = None
    scope: str | None = None
