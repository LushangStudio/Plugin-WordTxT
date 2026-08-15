from __future__ import annotations

import html
import re

from app.schemas.models import ContactMode, NoticeItem, NoticeResponse
from app.services.ai_service import AIService


ITEM_MARKER_RE = re.compile(r"\[ITEM_(\d+)\]")
TABLE_MARKER_RE = re.compile(r"<!--TABLE_PLACEHOLDER_(\d+)-->")
SOURCE_TABLE_MARKER_RE = re.compile(r"\[\[表格_\d+\]\]")


def sanitize_notice_text(value: str) -> str:
    text = str(value or "").replace("\r", "")
    text = re.sub(r"^\s*```(?:markdown|md|text)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)
    text = re.sub(r"(^|\n)\s{0,3}#{1,6}\s*", r"\1", text)
    text = re.sub(r"\*\*([^*\n]+?)\*\*", r"\1", text)
    text = re.sub(r"__([^_\n]+?)__", r"\1", text)
    text = re.sub(r"`([^`\n]+?)`", r"\1", text)
    text = re.sub(r"(^|\n)\s{0,3}[-*+]\s+", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_contact(text: str) -> str:
    return re.sub(r"联系人[:：][\s\S]*?(?:。|\n|$)", "", text)


def _format_items(items: list[NoticeItem]) -> tuple[str, list[str]]:
    table_map: list[str] = []
    blocks: list[str] = []
    for index, item in enumerate(items, start=1):
        content = item.content.strip()
        for table_html in item.tables_html:
            table_map.append(table_html)
            placeholder = f"<!--TABLE_PLACEHOLDER_{len(table_map)}-->"
            marker = SOURCE_TABLE_MARKER_RE.search(content)
            if marker:
                content = content[: marker.start()] + placeholder + content[marker.end() :]
            else:
                content += f"\n{placeholder}"
        content = SOURCE_TABLE_MARKER_RE.sub("[表格]", content)
        blocks.append(f"[ITEM_{index}]\n{content}")
    return "\n\n".join(blocks), table_map


def _missing_item_numbers(result: str, count: int) -> list[int]:
    found = {int(value) for value in ITEM_MARKER_RE.findall(result)}
    return [number for number in range(1, count + 1) if number not in found]


def _render_html(text: str, table_map: list[str]) -> tuple[str, list[int]]:
    escaped = html.escape(text)
    escaped = escaped.replace("\n", "<br>")
    missing_tables: list[int] = []
    for number, table_html in enumerate(table_map, start=1):
        escaped_marker = html.escape(f"<!--TABLE_PLACEHOLDER_{number}-->")
        if escaped_marker in escaped:
            escaped = escaped.replace(escaped_marker, table_html)
        else:
            missing_tables.append(number)
    if missing_tables:
        escaped += "".join(table_map[number - 1] for number in missing_tables)
    return escaped, missing_tables


class NoticeService:
    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def generate(
        self,
        *,
        items: list[NoticeItem],
        user_prompt: str,
        header: str,
        footer: str,
        contact_mode: ContactMode,
        workflow: str,
    ) -> NoticeResponse:
        itemized_text, table_map = _format_items(items)
        if contact_mode == ContactMode.REMOVE:
            itemized_text = _strip_contact(itemized_text)
        prompt = self._prompt(
            itemized_text=itemized_text,
            item_count=len(items),
            user_prompt=user_prompt,
            header=header,
            footer=footer,
            contact_mode=contact_mode,
            workflow=workflow,
        )
        model = (
            self.ai_service.settings.deepseek_table_notice_model
            if workflow == "table"
            else self.ai_service.settings.deepseek_generation_model
        )
        result = await self.ai_service.complete(prompt, model=model)
        missing = _missing_item_numbers(result, len(items))
        if missing:
            correction = self._correction_prompt(prompt, missing)
            result = await self.ai_service.complete(correction, model=model)
            missing = _missing_item_numbers(result, len(items))

        clean = sanitize_notice_text(result)
        clean = ITEM_MARKER_RE.sub(lambda match: f"{int(match.group(1))}. ", clean)
        rendered_html, _ = _render_html(clean, table_map)
        plain_text = TABLE_MARKER_RE.sub("[表格]", clean)
        return NoticeResponse(
            text=plain_text,
            html=rendered_html,
            missing_item_ids=[items[number - 1].id for number in missing],
        )

    @staticmethod
    def _prompt(
        *,
        itemized_text: str,
        item_count: int,
        user_prompt: str,
        header: str,
        footer: str,
        contact_mode: ContactMode,
        workflow: str,
    ) -> str:
        return f"""你是高校学工备忘处理助手。请把已经筛选通过的原文逐条改写成可直接使用的通知。

硬性规则：
1. 下方 {item_count} 个 [ITEM_n] 是白名单，必须全部保留，不得再次筛选、合并或删除。
2. 输出中必须原样保留每个 [ITEM_n]，每个标记只出现一次并单独成段。
3. 严格依据原文，不得虚构；缺失信息标注“未明确”。
4. 保留时间、地点、对象、链接、材料要求和重要后果。
5. 将院系内部口吻改为学生可理解的表达，但学生需配合的整改、签字、提交等事项不得删除。
6. 原样保留 <!--TABLE_PLACEHOLDER_n-->，不得修改、移动或删除。
7. 只输出纯文本，不使用 Markdown、HTML、标题符号或代码块。
8. 联系人模式为 {contact_mode.value}；工作流为 {workflow}。

处理要求：
{user_prompt}

通知开头：
{header}

通知结尾：
{footer}

===== 原文开始 =====
{itemized_text}
===== 原文结束 ====="""

    @staticmethod
    def _correction_prompt(original_prompt: str, missing: list[int]) -> str:
        values = "、".join(f"[ITEM_{number}]" for number in missing)
        return (
            original_prompt
            + f"\n\n重要纠错：上一次遗漏了 {values}。请重新输出完整结果，覆盖所有条目，不要只补遗漏项。"
        )
