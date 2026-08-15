from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import Settings, get_settings
from app.schemas.models import ExtractDocumentResponse, ParseDocumentResponse
from app.services.docx_service import extract_document, parse_document


router = APIRouter()


async def _read_docx(file: UploadFile, settings: Settings) -> tuple[str, bytes]:
    filename = file.filename or "document.docx"
    if filename.startswith("~$"):
        raise HTTPException(status_code=400, detail="不能上传 Word 临时锁文件（~$ 开头）。")
    if not filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="目前仅支持 .docx 文件。")
    payload = await file.read(settings.max_upload_bytes + 1)
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"文件不能超过 {settings.max_upload_mb} MB。")
    if not payload:
        raise HTTPException(status_code=400, detail="上传文件为空。")
    return filename, payload


@router.post("/extract", response_model=ExtractDocumentResponse)
async def extract(
    file: UploadFile = File(...), settings: Settings = Depends(get_settings)
) -> ExtractDocumentResponse:
    filename, payload = await _read_docx(file, settings)
    try:
        return extract_document(filename, payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"DOCX 提取失败：{exc}") from exc


@router.post("/parse", response_model=ParseDocumentResponse)
async def parse(
    file: UploadFile = File(...),
    start_number: int = Form(default=1, ge=1, le=9999),
    settings: Settings = Depends(get_settings),
) -> ParseDocumentResponse:
    filename, payload = await _read_docx(file, settings)
    try:
        return parse_document(filename, payload, start_number)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"DOCX 解析失败：{exc}") from exc

