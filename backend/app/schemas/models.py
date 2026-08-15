from enum import Enum

from pydantic import BaseModel, Field


class ContactMode(str, Enum):
    KEEP = "keep"
    REMOVE = "remove"


class FilterType(str, Enum):
    STUDENT = "student"
    GRADUATE = "graduate"
    NON_GRADUATE = "nonGraduate"
    DEPARTMENT_RECRUITMENT = "departmentRecruitment"


class TableReport(BaseModel):
    found: int = 0
    converted: int = 0
    failed: int = 0


class CutInfo(BaseModel):
    keyword: str | None = None
    paragraph_index: int | None = None
    offset: int | None = None


class CategoryMarker(BaseModel):
    title: str
    position: int
    level: int


class ParsedItem(BaseModel):
    uid: str
    number: int
    time: str = ""
    weekday: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    summary: str = ""
    content: str
    content_html: str
    tables_html: list[str] = Field(default_factory=list)
    raw_position: int
    category: str = ""
    subcategory: str = ""
    notes: str = ""


class ExtractedDocumentTable(BaseModel):
    marker: str
    html: str
    plain_text: str


class ExtractDocumentResponse(BaseModel):
    filename: str
    text: str
    character_count: int
    tables: list[ExtractedDocumentTable] = Field(default_factory=list)
    table_report: TableReport


class ParseDocumentResponse(BaseModel):
    filename: str
    items: list[ParsedItem]
    categories: list[CategoryMarker]
    cut_info: CutInfo
    table_report: TableReport


class FilterItem(BaseModel):
    id: str
    content: str = Field(min_length=1, max_length=60000)


class FilterRequest(BaseModel):
    filter_type: FilterType
    items: list[FilterItem] = Field(min_length=1, max_length=500)


class AudienceDecision(BaseModel):
    id: str
    student: bool = False
    graduate: bool = False
    non_graduate: bool = False
    department_recruitment: bool = False


class FilterResponse(BaseModel):
    kept_ids: list[str]
    decisions: list[AudienceDecision]


class NoticeItem(BaseModel):
    id: str
    content: str = Field(min_length=1, max_length=60000)
    tables_html: list[str] = Field(default_factory=list)


class NoticeRequest(BaseModel):
    items: list[NoticeItem] = Field(min_length=1, max_length=500)
    user_prompt: str = Field(default="", max_length=10000)
    header: str = Field(default="", max_length=1000)
    footer: str = Field(default="", max_length=1000)
    contact_mode: ContactMode = ContactMode.KEEP
    workflow: str = Field(default="content", pattern="^(content|table)$")


class NoticeResponse(BaseModel):
    text: str
    html: str
    missing_item_ids: list[str] = Field(default_factory=list)


class ExportItem(BaseModel):
    number: int
    time: str = ""
    weekday: str = ""
    contact_name: str = ""
    contact_phone: str = ""
    summary: str = ""
    content: str
    notes: str = ""


class ExportRequest(BaseModel):
    filename: str = "通知整理.xlsx"
    sort_type: str = "original"
    source_document: str = ""
    items: list[ExportItem] = Field(min_length=1, max_length=2000)


class HealthResponse(BaseModel):
    status: str
    environment: str
    ai_configured: bool
