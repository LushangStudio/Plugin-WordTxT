from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.models import NoticeRequest, NoticeResponse
from app.services.ai_service import AIService
from app.services.notice_service import NoticeService


router = APIRouter()


@router.post("/generate", response_model=NoticeResponse)
async def generate_notice(
    request: NoticeRequest, settings: Settings = Depends(get_settings)
) -> NoticeResponse:
    service = NoticeService(AIService(settings))
    return await service.generate(
        items=request.items,
        user_prompt=request.user_prompt,
        header=request.header,
        footer=request.footer,
        contact_mode=request.contact_mode,
        workflow=request.workflow,
    )

