from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    actual_settings = settings or get_settings()
    application = FastAPI(
        title="学工备忘 API",
        version="1.0.0",
        description="DOCX 解析、事项筛选、通知生成与 Excel 导出服务。",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=actual_settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    application.add_middleware(
        SessionMiddleware,
        secret_key=actual_settings.auth_session_secret,
        session_cookie=actual_settings.auth_session_cookie_name,
        max_age=actual_settings.auth_session_ttl_seconds,
        same_site="lax",
        https_only=(
            actual_settings.auth_session_cookie_secure
            or actual_settings.app_env.lower() == "production"
        ),
    )
    if settings is not None:
        application.dependency_overrides[get_settings] = lambda: actual_settings
    application.include_router(api_router, prefix="/api")

    @application.get("/")
    def root() -> dict[str, str]:
        return {
            "name": "学工备忘 API",
            "docs": "/docs",
            "health": "/api/health",
        }

    return application


app = create_app()
