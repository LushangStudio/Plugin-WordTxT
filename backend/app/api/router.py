from fastapi import APIRouter

from app.api.routes import documents, exports, filters, health, notices


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(filters.router, prefix="/filters", tags=["filters"])
api_router.include_router(notices.router, prefix="/notices", tags=["notices"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])

