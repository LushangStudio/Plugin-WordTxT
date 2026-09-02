from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    frontend_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_api_key: str = ""
    deepseek_generation_model: str = "deepseek-chat"
    deepseek_table_notice_model: str = "deepseek-chat"
    deepseek_filter_model: str = "deepseek-chat"
    deepseek_temperature: float = 0
    deepseek_timeout_seconds: int = 120

    uis_oauth_client_id: str = ""
    uis_oauth_client_secret: str = ""
    uis_oauth_authorization_url: str = (
        "https://id.fudan.edu.cn/idp/authCenter/authenticate"
    )
    uis_oauth_token_url: str = "https://id.fudan.edu.cn/idp/api/v3/oauth2/token"
    uis_oauth_user_info_url: str = "https://id.fudan.edu.cn/idp/api/v3/oauth2/userInfo"
    uis_oauth_logout_url: str = "https://id.fudan.edu.cn/idp/authCenter/GLO"
    uis_oauth_redirect_uri: str = "https://lushangstudio.fudan.edu.cn/api/auth/callback"
    auth_frontend_url: str = "https://lushangstudio.fudan.edu.cn"
    auth_session_secret: str = ""
    auth_session_cookie_name: str = "lushangstudio_session"
    auth_session_cookie_secure: bool = False
    auth_session_ttl_seconds: int = Field(default=8 * 60 * 60, ge=1)
    auth_state_ttl_seconds: int = Field(default=10 * 60, ge=1)

    max_upload_mb: int = Field(default=20, ge=1, le=100)

    @computed_field
    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @computed_field
    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def ai_configured(self) -> bool:
        return bool(
            self.deepseek_base_url.strip()
            and self.deepseek_api_key.strip()
            and self.deepseek_generation_model.strip()
        )

    @property
    def auth_configured(self) -> bool:
        return bool(
            self.uis_oauth_client_id.strip()
            and self.uis_oauth_client_secret.strip()
            and self.uis_oauth_redirect_uri.strip()
            and len(self.auth_session_secret.strip()) >= 32
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
