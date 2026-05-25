"""Context Packer -- compress context to reduce token count.

Strategies: whitespace compression, deduplication, boilerplate
stripping, and budget truncation.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass


@dataclass
class PackResult:
    """Result of packing a prompt."""

    packed: str
    original_tokens: int
    packed_tokens: int
    savings: str


@dataclass
class PackerConfig:
    """Packer configuration."""

    max_tokens: int = 100_000
    deduplication: bool = True
    strip_boilerplate: bool = True
    compress_whitespace: bool = True


class Packer:
    """Compress context to reduce token count."""

    def __init__(self, config: PackerConfig | None = None) -> None:
        self._config = config or PackerConfig()

    def pack(self, input_text: str, system: str | None = None) -> PackResult:
        """Pack a prompt and optional system message."""
        original = f"{system}\n\n{input_text}" if system else input_text
        original_tokens = self.estimate_tokens(original)

        packed = original

        if self._config.compress_whitespace:
            packed = self._compress_whitespace(packed)

        if self._config.deduplication:
            packed = self._deduplicate(packed)

        if self._config.strip_boilerplate:
            packed = self._strip_boilerplate(packed)

        packed = self._truncate_to_limit(packed)

        packed_tokens = self.estimate_tokens(packed)
        savings_pct = (
            round((1 - packed_tokens / original_tokens) * 100)
            if original_tokens > 0
            else 0
        )

        return PackResult(
            packed=packed,
            original_tokens=original_tokens,
            packed_tokens=packed_tokens,
            savings=f"{max(0, savings_pct)}%",
        )

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Rough token estimate: ~4 chars per token."""
        return math.ceil(len(text) / 4)

    def _compress_whitespace(self, text: str) -> str:
        lines = [line.rstrip() for line in text.split("\n")]
        joined = "\n".join(lines)
        return re.sub(r"\n{3,}", "\n\n", joined).strip()

    def _deduplicate(self, text: str) -> str:
        blocks = text.split("\n\n")
        seen: set[str] = set()
        unique: list[str] = []
        for block in blocks:
            normalized = block.strip().lower()
            if not normalized:
                continue
            if len(normalized) > 50 and normalized in seen:
                continue
            seen.add(normalized)
            unique.append(block)
        return "\n\n".join(unique)

    def _strip_boilerplate(self, text: str) -> str:
        patterns = [
            re.compile(
                r"^/\*\*?\s*\n(\s*\*\s*@(param|returns|throws|example).*\n)*\s*\*/",
                re.MULTILINE,
            ),
            re.compile(r"^//\s*eslint-disable.*$", re.MULTILINE),
            re.compile(r"^//\s*@ts-(ignore|expect-error|nocheck).*$", re.MULTILINE),
            re.compile(r"^'use strict';?\s*$", re.MULTILINE),
            re.compile(r"^/\*\s*istanbul ignore (next|else)\s*\*/$", re.MULTILINE),
        ]
        result = text
        for pat in patterns:
            result = pat.sub("", result)
        return re.sub(r"\n{3,}", "\n\n", result).strip()

    def _truncate_to_limit(self, text: str) -> str:
        max_chars = self._config.max_tokens * 4
        if len(text) <= max_chars:
            return text
        truncated = text[:max_chars]
        last_nl = truncated.rfind("\n")
        cut = last_nl if last_nl > max_chars * 0.8 else max_chars
        return truncated[:cut] + "\n\n[Truncated -- context exceeded budget]"
