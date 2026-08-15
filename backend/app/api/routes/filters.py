from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.models import FilterRequest, FilterResponse, FilterType
from app.services.ai_service import AIService


router = APIRouter()


@router.post("/classify", response_model=FilterResponse)
async def classify(
    request: FilterRequest, settings: Settings = Depends(get_settings)
) -> FilterResponse:
    decisions = await AIService(settings).classify(request.items, request.filter_type)

    def keep(decision) -> bool:
        if request.filter_type == FilterType.STUDENT:
            return decision.student
        if request.filter_type == FilterType.GRADUATE:
            return decision.graduate
        if request.filter_type == FilterType.NON_GRADUATE:
            return decision.non_graduate
        return decision.department_recruitment

    return FilterResponse(
        kept_ids=[decision.id for decision in decisions if keep(decision)],
        decisions=decisions,
    )

