from __future__ import annotations

import json
import re
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings
from app.schemas.models import AudienceDecision, FilterItem, FilterType


def _extract_json(value: str) -> Any:
    text = str(value or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    array_start, array_end = text.find("["), text.rfind("]")
    if array_start >= 0 and array_end > array_start:
        text = text[array_start : array_end + 1]
    return json.loads(text)


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value == 1
    return str(value or "").strip().lower() in {
        "true",
        "yes",
        "1",
        "是",
        "保留",
        "学生事项",
    }


class AIService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _require_configuration(self) -> None:
        if not self.settings.ai_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI 服务尚未配置，请在 backend/.env 中填写 DEEPSEEK_API_KEY。",
            )

    async def complete(
        self,
        prompt: str,
        *,
        model: str | None = None,
        system: str = "你是高校学工备忘处理助手，严格依据用户提供的原文内容生成结果。",
        temperature: float | None = None,
    ) -> str:
        self._require_configuration()
        url = self.settings.deepseek_base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": model or self.settings.deepseek_generation_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": self.settings.deepseek_temperature if temperature is None else temperature,
        }
        try:
            async with httpx.AsyncClient(timeout=self.settings.deepseek_timeout_seconds) as client:
                response = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {self.settings.deepseek_api_key}",
                    },
                    json=payload,
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail="AI 请求超时，请稍后重试。") from exc
        except httpx.HTTPStatusError as exc:
            message = exc.response.text[:500]
            raise HTTPException(
                status_code=502,
                detail=f"AI 服务返回错误（{exc.response.status_code}）：{message}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"无法连接 AI 服务：{exc}") from exc

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise HTTPException(status_code=502, detail="AI 服务返回了空结果。")
        return str(content)

    @staticmethod
    def _chunks(items: list[FilterItem], max_chars: int = 12000) -> list[list[FilterItem]]:
        chunks: list[list[FilterItem]] = []
        current: list[FilterItem] = []
        size = 0
        for item in items:
            item_size = len(item.content) + 80
            if current and size + item_size > max_chars:
                chunks.append(current)
                current = []
                size = 0
            current.append(item)
            size += item_size
        if current:
            chunks.append(current)
        return chunks

    async def classify(
        self, items: list[FilterItem], filter_type: FilterType
    ) -> list[AudienceDecision]:
        decisions: dict[str, AudienceDecision] = {}
        for chunk in self._chunks(items):
            prompt = self._classification_prompt(chunk)
            result = await self.complete(
                prompt,
                model=self.settings.deepseek_filter_model,
                temperature=0,
            )
            parsed = _extract_json(result)
            rows = parsed if isinstance(parsed, list) else parsed.get("items", [])
            for row in rows:
                item_id = str(row.get("id", ""))
                decisions[item_id] = AudienceDecision(
                    id=item_id,
                    student=_bool(row.get("student", row.get("keep"))),
                    graduate=_bool(row.get("graduate")),
                    non_graduate=_bool(row.get("nonGraduate", row.get("non_graduate"))),
                    department_recruitment=_bool(
                        row.get("departmentRecruitment", row.get("department_recruitment"))
                    ),
                )
        missing = [item.id for item in items if item.id not in decisions]
        if missing:
            raise HTTPException(status_code=502, detail=f"AI 分类结果缺少条目：{', '.join(missing)}")
        return [decisions[item.id] for item in items]

    @staticmethod
    def _classification_prompt(items: list[FilterItem]) -> str:
        data = [{"id": item.id, "text": item.content} for item in items]
        return f"""请判断以下学工备忘条目的学生对象类型。

规则：
1. student=true：最终参与者、受益者或提交者明确包含学生、同学、本科生、研究生、毕业生或全校师生。
2. graduate=true：原文明确定向毕业生、毕业班、毕业年级、毕业届、大四、研三、离校或毕业手续。
3. nonGraduate=true：原文明确定向非毕业班、低年级、大一、大二、大三或非毕业生。
4. departmentRecruitment=true：明确要求院系招募、动员、组织、推荐学生，或汇总报送学生名单和材料。
5. 仅内部行政工作且学生不是最终对象时全部为 false；不确定的字段设为 false。

只输出合法 JSON 数组，不要解释：
[{{"id":"条目ID","student":true,"graduate":false,"nonGraduate":false,"departmentRecruitment":false}}]

待判断条目：
{json.dumps(data, ensure_ascii=False, indent=2)}"""

