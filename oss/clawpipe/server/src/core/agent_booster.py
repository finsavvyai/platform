"""Agent Booster — skip LLM for deterministic transforms at sub-millisecond speed."""

import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("finsavvyai.agent_booster")

# Registry of deterministic handlers: pattern -> handler function
_HANDLERS: Dict[str, Callable] = {}


def register_handler(pattern: str):
    """Decorator to register a deterministic handler for a message pattern."""
    def decorator(fn: Callable):
        _HANDLERS[pattern] = fn
        return fn
    return decorator


def _extract_json_payload(content: str) -> str:
    """Extract JSON from a message, stripping trigger phrases and code fences."""
    # Try code blocks first
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if json_match:
        return json_match.group(1).strip()
    # Strip common trigger phrases
    text = re.sub(r"^(?:validate|format|pretty\s+format)\s+(?:this\s+)?json\s*", "", content, flags=re.IGNORECASE)
    return text.strip()


@register_handler("validate json")
def _validate_json(content: str) -> Dict[str, Any]:
    """Validate JSON string without calling LLM."""
    text = _extract_json_payload(content)
    try:
        parsed = json.loads(text)
        return {"valid": True, "parsed": parsed, "type": type(parsed).__name__}
    except json.JSONDecodeError as e:
        return {"valid": False, "error": str(e), "position": e.pos}


@register_handler("format json")
def _format_json(content: str) -> Dict[str, Any]:
    """Pretty-format JSON without calling LLM."""
    text = _extract_json_payload(content)
    try:
        parsed = json.loads(text)
        return {"formatted": json.dumps(parsed, indent=2, sort_keys=True)}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON: {e}"}


@register_handler("count tokens")
def _count_tokens(content: str) -> Dict[str, Any]:
    """Approximate token count without calling LLM."""
    words = content.split()
    chars = len(content)
    approx_tokens = max(len(words), chars // 4)
    return {"words": len(words), "characters": chars, "approx_tokens": approx_tokens}


@register_handler("list models")
def _list_available_patterns(_content: str) -> Dict[str, Any]:
    """List available booster patterns."""
    return {"patterns": list(_HANDLERS.keys())}


# Patterns that trigger booster (checked against user message)
_TRIGGER_PATTERNS = [
    (re.compile(r"^validate\s+(this\s+)?json", re.IGNORECASE), "validate json"),
    (re.compile(r"^(pretty\s+)?format\s+(this\s+)?json", re.IGNORECASE), "format json"),
    (re.compile(r"^count\s+(the\s+)?tokens", re.IGNORECASE), "count tokens"),
    (re.compile(r"^(what|list)\s+(booster\s+)?(patterns|commands)", re.IGNORECASE), "list models"),
]


class AgentBooster:
    """Skip LLM for deterministic operations. Sub-millisecond, zero cost."""

    def __init__(self) -> None:
        self._boosted_count = 0
        self._total_saved_ms = 0.0

    def try_boost(self, messages: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Try to handle the request without calling LLM.

        Returns a response dict if boosted, None if LLM is needed.
        """
        if not messages:
            return None

        last_msg = messages[-1]
        if last_msg.get("role") != "user":
            return None

        content = last_msg.get("content", "")
        if not isinstance(content, str):
            return None

        handler_key = self._match_pattern(content)
        if handler_key is None:
            return None

        handler = _HANDLERS.get(handler_key)
        if handler is None:
            return None

        t0 = time.monotonic()
        result = handler(content)
        elapsed_ms = (time.monotonic() - t0) * 1000

        self._boosted_count += 1
        self._total_saved_ms += max(500.0 - elapsed_ms, 0)  # estimate LLM would take 500ms

        logger.info("Agent Booster handled pattern=%s elapsed_ms=%.2f", handler_key, elapsed_ms)

        return {
            "boosted": True,
            "pattern": handler_key,
            "result": result,
            "elapsed_ms": round(elapsed_ms, 3),
            "cost": 0.0,
        }

    def _match_pattern(self, content: str) -> Optional[str]:
        """Match user message against trigger patterns."""
        content_trimmed = content.strip()
        for regex, handler_key in _TRIGGER_PATTERNS:
            if regex.search(content_trimmed):
                return handler_key
        return None

    @property
    def stats(self) -> Dict[str, Any]:
        return {
            "boosted_requests": self._boosted_count,
            "estimated_saved_ms": round(self._total_saved_ms, 1),
            "available_patterns": len(_HANDLERS),
        }


# Singleton
_booster: Optional[AgentBooster] = None


def get_agent_booster() -> AgentBooster:
    global _booster
    if _booster is None:
        _booster = AgentBooster()
    return _booster
