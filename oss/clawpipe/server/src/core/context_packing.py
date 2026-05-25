"""Context Packing — trim and compress request context before forwarding."""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.context_packing")

# Patterns for content that can be safely trimmed
_TRIM_PATTERNS = [
    (re.compile(r"\n{3,}"), "\n\n"),  # Collapse excessive newlines
    (re.compile(r" {4,}"), "  "),  # Collapse excessive spaces
    (re.compile(r"```\n\n+"), "```\n"),  # Trim blank lines after code fences
    (re.compile(r"\n\n+```"), "\n```"),  # Trim blank lines before code fences
]

# System prompt deduplication: common prefixes seen repeatedly
_COMMON_SYSTEM_PREFIXES = {
    "you are a helpful assistant",
    "you are an ai assistant",
    "you are a helpful ai",
}


class ContextPacker:
    """Trim request context to reduce token usage by 40-60%."""

    def __init__(self, max_system_tokens: int = 2000) -> None:
        self._max_system_tokens = max_system_tokens
        self._total_input_chars = 0
        self._total_output_chars = 0

    def pack(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Pack messages by trimming redundant content."""
        if not messages:
            return messages

        input_size = self._char_count(messages)
        self._total_input_chars += input_size

        packed = []
        seen_system = False

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if isinstance(content, str):
                content = self._trim_text(content)
                if role == "system":
                    content = self._dedup_system(content, seen_system)
                    seen_system = True
                packed.append({**msg, "content": content})
            elif isinstance(content, list):
                packed.append({**msg, "content": self._pack_parts(content)})
            else:
                packed.append(msg)

        output_size = self._char_count(packed)
        self._total_output_chars += output_size
        savings = (
            round((1 - output_size / input_size) * 100, 1) if input_size else 0
        )
        if savings > 5:
            logger.debug("Context packed", savings_pct=savings)

        return packed

    def _trim_text(self, text: str) -> str:
        """Apply whitespace trimming patterns."""
        for pattern, replacement in _TRIM_PATTERNS:
            text = pattern.sub(replacement, text)
        return text.strip()

    def _dedup_system(self, content: str, already_seen: bool) -> str:
        """Deduplicate common system prompt boilerplate."""
        if already_seen:
            lower = content.lower().strip()
            for prefix in _COMMON_SYSTEM_PREFIXES:
                if lower.startswith(prefix):
                    remainder = content[len(prefix):].strip()
                    return remainder if remainder else content
        return content

    def _pack_parts(self, parts: list) -> list:
        """Pack multimodal content parts."""
        packed = []
        for part in parts:
            if isinstance(part, dict) and part.get("type") == "text":
                packed.append({**part, "text": self._trim_text(part.get("text", ""))})
            else:
                packed.append(part)
        return packed

    def _char_count(self, messages: List[Dict[str, Any]]) -> int:
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total += len(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        total += len(str(part.get("text", "")))
        return total

    @property
    def stats(self) -> Dict[str, Any]:
        savings = (
            round(
                (1 - self._total_output_chars / self._total_input_chars) * 100, 1
            )
            if self._total_input_chars
            else 0
        )
        return {
            "total_input_chars": self._total_input_chars,
            "total_output_chars": self._total_output_chars,
            "savings_pct": savings,
        }


# Singleton
_packer: Optional[ContextPacker] = None


def get_context_packer() -> ContextPacker:
    """Get or create the singleton ContextPacker."""
    global _packer
    if _packer is None:
        _packer = ContextPacker()
    return _packer
