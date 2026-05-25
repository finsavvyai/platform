"""OpenCLaw streaming chat mixin."""

import json
import logging
from typing import Any, AsyncIterator, Dict, List

logger = logging.getLogger("finsavvyai.openclaw")


class OpenCLawStreamingMixin:
    """Streaming methods mixed into OpenCLawClient."""

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "default",
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Stream chat completions from OpenCLaw."""
        session = await self._get_session()

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }

        total_chars = sum(len(m.get("content", "")) for m in messages)

        logger.debug(
            "OpenCLaw stream request",
            model=model,
            message_count=len(messages),
            chars=total_chars,
        )

        try:
            async with session.post(
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers=self._get_headers(),
            ) as response:
                async for chunk in self._iter_sse(response):
                    yield chunk

        except Exception as e:
            logger.error(f"OpenCLaw stream error: {e}")
            yield f"[Error: {e}]"

    @staticmethod
    async def _iter_sse(response: Any) -> AsyncIterator[str]:
        """Parse Server-Sent Events stream into content chunks."""
        async for line in response.content:
            line_str = line.decode("utf-8").strip()
            if not line_str or line_str == "data: [DONE]":
                continue
            if line_str.startswith("data: "):
                try:
                    chunk = json.loads(line_str[5:].strip())
                    content = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    pass
