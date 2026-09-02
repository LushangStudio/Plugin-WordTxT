from fastapi import APIRouter, Depends

from app.api.routes import auth, documents, exports, filters, health, notices
from app.core.auth import require_current_user


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
authentication = [Depends(require_current_user)]
api_router.include_router(
    documents.router,
    prefix="/documents",
    tags=["documents"],
    dependencies=authentication,
)
api_router.include_router(
    filters.router,
    prefix="/filters",
    tags=["filters"],
    dependencies=authentication,
)
api_router.include_router(
    notices.router,
    prefix="/notices",
    tags=["notices"],
    dependencies=authentication,
)
api_router.include_router(
    exports.router,
    prefix="/exports",
    tags=["exports"],
    dependencies=authentication,
)
