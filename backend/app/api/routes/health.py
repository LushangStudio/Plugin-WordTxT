from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.models import HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        status="ok",
        environment=settings.app_env,
        ai_configured=settings.ai_configured,
    )

