"""OpenCLaw vision/multimodal capabilities mixin."""

import asyncio
import base64
import logging
from typing import Any, AsyncIterator, Dict, List

logger = logging.getLogger("finsavvyai.openclaw")


class OpenCLawVisionMixin:
    """Vision methods mixed into OpenCLawClient."""

    def _contains_image(self, message: Dict) -> bool:
        content = message.get("content", [])
        if isinstance(content, str):
            return False
        if isinstance(content, list):
            return any(item.get("type") in ("image_url", "image") for item in content)
        return False

    def _has_vision_content(self, messages: List[Dict]) -> bool:
        return any(self._contains_image(msg) for msg in messages)

    def _prepare_vision_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        prepared = []
        for msg in messages:
            content, role = msg.get("content", ""), msg.get("role", "user")
            if isinstance(content, str):
                prepared.append({"role": role, "content": content})
                continue
            if not isinstance(content, list):
                continue
            validated = []
            for item in content:
                t = item.get("type")
                if t == "text":
                    validated.append({"type": "text", "text": item.get("text", "")})
                elif t == "image_url":
                    url = self._extract_image_url(item)
                    if url and not self._image_too_large(url):
                        validated.append({"type": "image_url", "image_url": {"url": url}})
                elif t == "image":
                    converted = self._convert_image_item(item)
                    if converted:
                        validated.append(converted)
                else:
                    validated.append(item)
            prepared.append({"role": role, "content": validated})
        return prepared

    @staticmethod
    def _extract_image_url(item: Dict) -> str:
        image_data = item.get("image_url", {})
        return image_data.get("url", "") if isinstance(image_data, dict) else image_data

    def _image_too_large(self, url: str) -> bool:
        if not url.startswith("data:image"):
            return False
        try:
            b64 = url.split(",", 1)[1] if "," in url else url
            if len(base64.b64decode(b64)) > self.MAX_IMAGE_SIZE:
                logger.warning("Image exceeds size limit")
                return True
        except Exception:
            pass
        return False

    @staticmethod
    def _convert_image_item(item: Dict) -> dict:
        image_obj = item.get("image")
        if not image_obj:
            return None
        try:
            import io
            from PIL import Image
            if isinstance(image_obj, Image.Image):
                buf = io.BytesIO()
                image_obj.save(buf, format="JPEG")
                b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                return {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        except ImportError:
            return item
        except Exception as e:
            logger.warning(f"Failed to process image: {e}")
            return None
        return {"type": "image_url", "image_url": {"url": str(image_obj)}}

    async def complete_vision(self, messages: List[Dict[str, Any]], model: str = "default",
                              max_tokens: int = 2048, temperature: float = 0.7) -> Dict[str, Any]:
        session = await self._get_session()
        prepared = self._prepare_vision_messages(messages)
        payload = {"model": model, "messages": prepared, "max_tokens": max_tokens, "stream": False}
        logger.info("OpenCLaw vision completion", model=model, messages=len(messages))
        try:
            async with session.post(f"{self.base_url}/v1/chat/completions",
                                    json=payload, headers=self._get_headers()) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    logger.info("OpenCLaw vision completion successful")
                    return self._extract_text_result(result)
                error_text = await resp.text()
                logger.error("OpenCLaw vision failed", status=resp.status)
                return {"error": f"OpenCLaw returned {resp.status}", "status": "vision_error",
                        "details": error_text}
        except Exception as e:
            logger.error(f"OpenCLaw vision request error: {e}")
            return {"error": "Failed to connect to OpenCLaw for vision",
                    "status": "status_code_500", "reason": str(e)}

    async def stream_chat_vision(self, messages: List[Dict[str, Any]], model: str = "default",
                                 temperature: float = 0.7) -> AsyncIterator[str]:
        session = await self._get_session()
        prepared = self._prepare_vision_messages(messages)
        payload = {"model": model, "messages": prepared, "temperature": temperature, "stream": True}
        logger.info("OpenCLaw vision stream", model=model, messages=len(messages))
        try:
            async with session.post(f"{self.base_url}/v1/chat/completions",
                                    json=payload, headers=self._get_headers()) as resp:
                async for chunk in self._iter_sse(resp):
                    yield chunk
        except Exception as e:
            logger.error(f"OpenCLaw vision stream error: {e}")
            yield f"[Error: {e}]"

    async def batch_complete_vision(self, requests: List[Dict[str, Any]],
                                    max_concurrent: int = 5) -> List[Dict[str, Any]]:
        sem = asyncio.Semaphore(max_concurrent)

        async def _one(req):
            async with sem:
                try:
                    return await self.complete_vision(**req)
                except Exception as e:
                    logger.error(f"Batch vision request failed: {e}")
                    return {"error": str(e), "status": "batch_error"}

        return list(await asyncio.gather(*[_one(r) for r in requests]))
