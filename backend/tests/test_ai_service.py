import json

import httpx
import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.services.ai_service import AIService


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["bearer", "appkey"])
async def test_gateway_request(monkeypatch, mode):
    original_client = httpx.AsyncClient
    settings = Settings(
        _env_file=None,
        deepseek_api_key="test-only-key",
        deepseek_auth_mode=mode,
        deepseek_base_url="https://example.test/v1/",
        deepseek_endpoint_url="https://example.test/gateway/flash" if mode == "appkey" else "",
        deepseek_generation_model="deepseek-v4-flash-vllm",
    )

    def handle(request):
        expected = "https://example.test/gateway/flash" if mode == "appkey" else "https://example.test/v1/chat/completions"
        assert str(request.url) == expected
        assert request.headers["content-type"] == "application/json;charset=utf-8"
        if mode == "appkey":
            assert request.headers["appkey"] == "test-only-key"
            assert "authorization" not in request.headers
        else:
            assert request.headers["authorization"] == "Bearer test-only-key"
            assert "appkey" not in request.headers
        payload = json.loads(request.content)
        assert payload["model"] == "deepseek-v4-flash-vllm"
        assert payload["messages"][-1] == {"role": "user", "content": "测试"}
        return httpx.Response(200, json={"choices": [{"message": {"content": "成功"}}]})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original_client(transport=httpx.MockTransport(handle), **kwargs))
    assert await AIService(settings).complete("测试") == "成功"


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{}, {"choices": []}, {"choices": [{"message": {"content": None}}]}])
async def test_invalid_response_is_502(monkeypatch, payload):
    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original_client(transport=transport, **kwargs))
    with pytest.raises(HTTPException) as error:
        await AIService(Settings(_env_file=None, deepseek_api_key="test-only-key")).complete("测试")
    assert error.value.status_code == 502
