from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.models import ExportRequest
from app.services.export_service import build_workbook


router = APIRouter()


@router.post("/xlsx")
def export_xlsx(request: ExportRequest) -> StreamingResponse:
    filename = request.filename.strip() or "通知整理.xlsx"
    if not filename.lower().endswith(".xlsx"):
        filename += ".xlsx"
    payload = build_workbook(request)
    return StreamingResponse(
        BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )

