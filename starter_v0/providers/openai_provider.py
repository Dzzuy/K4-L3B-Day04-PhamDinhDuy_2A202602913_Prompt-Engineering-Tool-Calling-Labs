from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from providers.base import ModelResponse, ToolCall


class OpenAIProvider:
    """OpenAI Chat Completions provider with normalized tool_calls output."""

    RATE_LIMIT_BACKOFF_SECONDS = (5.0, 15.0, 30.0)

    def __init__(
        self,
        *,
        api_key_env: str = "OPENAI_API_KEY",
        base_url: str | None = None,
        default_model: str = "gpt-4o-mini",
        request_timeout: float = 60.0,
    ) -> None:
        self.api_key_env = api_key_env
        self.base_url = base_url
        self.default_model = default_model
        self.request_timeout = request_timeout

    @staticmethod
    def _retry_after_seconds(exc: Exception, fallback: float) -> float:
        response = getattr(exc, "response", None)
        headers = getattr(response, "headers", {}) or {}
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        if not retry_after:
            return fallback
        try:
            return max(0.0, float(retry_after))
        except (TypeError, ValueError):
            try:
                retry_at = parsedate_to_datetime(retry_after)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError):
                return fallback

    @staticmethod
    def _is_rate_limit_error(exc: Exception) -> bool:
        return getattr(exc, "status_code", None) == 429 or type(exc).__name__ == "RateLimitError"

    def complete(
        self,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
        *,
        model: str | None = None,
        temperature: float = 0.0,
        tool_choice: Any | None = None,
    ) -> ModelResponse:
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("Install live provider dependency first: pip install openai") from exc

        api_key = os.getenv(self.api_key_env)
        if not api_key:
            raise RuntimeError(f"Missing API key env var: {self.api_key_env}")

        client = OpenAI(api_key=api_key, base_url=self.base_url, timeout=self.request_timeout)
        kwargs: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
        if tool_choice is not None:
            kwargs["tool_choice"] = tool_choice

        for attempt, fallback_delay in enumerate((*self.RATE_LIMIT_BACKOFF_SECONDS, None), start=1):
            try:
                resp = client.chat.completions.create(**kwargs)
                break
            except Exception as exc:
                if not self._is_rate_limit_error(exc) or fallback_delay is None:
                    raise
                delay = self._retry_after_seconds(exc, fallback_delay)
                print(f"Rate limited; retrying request {attempt}/3 in {delay:g}s...", flush=True)
                time.sleep(delay)
        msg = resp.choices[0].message
        calls: list[ToolCall] = []
        for call in msg.tool_calls or []:
            args = json.loads(call.function.arguments or "{}")
            calls.append(ToolCall(name=call.function.name, args=args))
        return ModelResponse(text=msg.content, tool_calls=calls, raw=resp)
