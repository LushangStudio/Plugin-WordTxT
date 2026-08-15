import io

from openpyxl import load_workbook

from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.models import ExportItem, ExportRequest, NoticeItem
from app.services.export_service import build_workbook
from app.services.notice_service import _format_items


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "ai_configured" in response.json()


def test_ai_filter_requires_backend_key(client):
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="")
    try:
        response = client.post(
            "/api/filters/classify",
            json={
                "filter_type": "student",
                "items": [{"id": "item-1", "content": "测试事项"}],
            },
        )
        assert response.status_code == 503
        assert "API" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_settings, None)


def test_extract_document(client, sample_docx):
    response = client.post(
        "/api/documents/extract",
        files={"file": ("sample.docx", sample_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["character_count"] > 50
    assert "活动报名" in data["text"]
    assert data["table_report"]["found"] == 1
    assert "[[表格_1]]" in data["text"]
    assert len(data["tables"]) == 1
    assert data["tables"][0]["marker"] == "[[表格_1]]"
    assert "材料 | 数量" in data["tables"][0]["plain_text"]
    assert data["tables"][0]["html"].count("<tr>") == 2
    assert data["tables"][0]["html"].count("<td") == 4


def test_notice_items_restore_source_table_at_marker():
    formatted, tables = _format_items(
        [
            NoticeItem(
                id="item-1",
                content="表格前内容\n[[表格_1]]\n表格后内容",
                tables_html=["<table><tr><td>测试</td></tr></table>"],
            )
        ]
    )
    assert tables == ["<table><tr><td>测试</td></tr></table>"]
    assert "表格前内容\n<!--TABLE_PLACEHOLDER_1-->\n表格后内容" in formatted
    assert "[[表格_1]]" not in formatted


def test_parse_document_and_cut_sections(client, sample_docx):
    response = client.post(
        "/api/documents/parse",
        files={"file": ("sample.docx", sample_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"start_number": "1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["cut_info"]["keyword"] == "工作提醒"
    assert all("不应进入" not in item["content"] for item in data["items"])
    assert any(item["tables_html"] for item in data["items"])


def test_parse_preserves_every_row_and_column(client, multi_column_table_docx):
    response = client.post(
        "/api/documents/parse",
        files={
            "file": (
                "multi-column.docx",
                multi_column_table_docx,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        data={"start_number": "1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["table_report"] == {"found": 1, "converted": 1, "failed": 0}
    assert len(data["items"]) == 1

    table_html = data["items"][0]["tables_html"][0]
    assert table_html.count("<tr>") == 4
    assert table_html.count("<td") == 16
    for row_index in range(1, 5):
        for column_index in range(1, 5):
            assert f"R{row_index}C{column_index}" in table_html


def test_parse_preserves_merged_cell_spans(client, merged_table_docx):
    response = client.post(
        "/api/documents/parse",
        files={
            "file": (
                "merged-table.docx",
                merged_table_docx,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
        data={"start_number": "1"},
    )
    assert response.status_code == 200
    table_html = response.json()["items"][0]["tables_html"][0]
    assert table_html.count("<tr>") == 4
    assert table_html.count("<td") == 13
    assert 'rowspan="3"' in table_html
    assert 'colspan="2"' in table_html


def test_export_workbook():
    payload = build_workbook(
        ExportRequest(
            source_document="学工例会备忘.docx",
            items=[
                ExportItem(number=1, summary="短事项", content="测试内容"),
                ExportItem(
                    number=2,
                    summary="需要自动换行并调整高度的较长工作概述",
                    content=(
                        "这是一段没有手动换行的长中文内容，用于验证导出的工作簿能够根据列宽估算实际折行数，"
                        "并在打开 Excel 时直接显示为合适的行高，不再需要人工点击自动调整行高。" * 3
                    ),
                    notes="第一行备注\n第二行备注",
                ),
            ],
        )
    )
    assert payload[:2] == b"PK"
    assert len(payload) > 1000

    workbook = load_workbook(io.BytesIO(payload))
    sheet = workbook["通知整理"]
    assert sheet.freeze_panes == "A2"
    assert sheet.auto_filter.ref == "A1:H3"
    assert sheet.sheet_view.showGridLines is False
    assert sheet.column_dimensions["G"].width <= 72
    assert sheet.column_dimensions["G"].width >= 36
    assert sheet.row_dimensions[3].height > sheet.row_dimensions[2].height
    assert sheet.row_dimensions[3].height <= 409
    assert sheet["G3"].alignment.wrap_text is True
    assert sheet["G3"].alignment.vertical == "top"

    metadata = workbook["元数据"]
    assert metadata.freeze_panes == "A2"
    assert metadata.column_dimensions["B"].width >= 24
