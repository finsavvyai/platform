"""
Agent Booster: Fast PII Detector.

Deterministic regex-based PII detection that skips LLM calls entirely
for unambiguous patterns. Achieves sub-millisecond detection for common
PII types: emails, phone numbers, SSNs, credit cards, IPs, dates of birth.

Opt-in via AGENT_BOOSTER_ENABLED=true environment variable.
"""

from __future__ import annotations

import logging
import os
import time

from app.services.fast_pii_metrics import BoosterMetrics
from app.services.fast_pii_patterns import (
    AMBIGUITY_SIGNALS,
    FAST_PII_PATTERNS,
    PIIMatch,
    luhn_check,
    validate_ip_range,
)

logger = logging.getLogger(__name__)


def _is_enabled() -> bool:
    """Check if Agent Booster is enabled via environment."""
    return os.environ.get("AGENT_BOOSTER_ENABLED", "").lower() in (
        "true",
        "1",
        "yes",
    )


class FastPIIDetector:
    """
    Sub-millisecond PII detector using compiled regex patterns.

    Use as a fast-path before expensive LLM/ML-based detection.
    Only handles well-structured, deterministic PII formats.
    """

    def __init__(self, enabled: bool | None = None):
        self.enabled = enabled if enabled is not None else _is_enabled()
        self.metrics = BoosterMetrics()
        self._patterns = FAST_PII_PATTERNS
        logger.info(
            "Agent Booster FastPIIDetector initialized "
            f"(enabled={self.enabled}, patterns={len(self._patterns)})"
        )

    def can_handle(self, text: str) -> bool:
        """
        Check if all PII in the text can be handled by regex alone.

        Returns False if the text contains ambiguous entities
        (person names, addresses, passports) that require NER/LLM.
        """
        if not self.enabled:
            return False
        return not bool(AMBIGUITY_SIGNALS.search(text))

    def detect(self, text: str) -> list[PIIMatch]:
        """
        Detect PII in text using compiled regex patterns.

        Returns a list of PIIMatch objects sorted by start position.
        Runs validation (Luhn, IP range) on applicable matches.
        """
        if not self.enabled:
            return []

        start_ns = time.perf_counter_ns()
        matches: list[PIIMatch] = []

        for pattern_def in self._patterns:
            for m in pattern_def.pattern.finditer(text):
                matched_text = m.group()
                confidence = pattern_def.confidence

                # Run validators for higher accuracy
                if pattern_def.validator == "luhn":
                    if not luhn_check(matched_text):
                        continue
                    confidence = 0.95
                elif pattern_def.validator == "ip_range":
                    if not validate_ip_range(matched_text):
                        continue

                matches.append(
                    PIIMatch(
                        pii_type=pattern_def.pii_type,
                        start=m.start(),
                        end=m.end(),
                        matched_text=matched_text,
                        confidence=confidence,
                    )
                )

        # Sort by position
        matches.sort(key=lambda x: x.start)

        # Record metrics
        elapsed_us = (time.perf_counter_ns() - start_ns) / 1000
        matched_types = list({m.pii_type.value for m in matches})
        self.metrics.record_fast_path(elapsed_us, matched_types)

        return matches

    def mask(self, text: str, matches: list[PIIMatch]) -> str:
        """
        Replace detected PII with [REDACTED_TYPE] labels.

        Processes matches in reverse order to preserve string indices.
        """
        if not matches:
            return text

        result = text
        for match in sorted(matches, key=lambda m: m.start, reverse=True):
            result = (
                result[: match.start]
                + match.redacted_label
                + result[match.end :]
            )
        return result

    def detect_and_mask(self, text: str) -> tuple[str, list[PIIMatch]]:
        """
        Convenience method: detect PII and return masked text + matches.
        """
        matches = self.detect(text)
        masked = self.mask(text, matches)
        return masked, matches

    def get_metrics(self) -> dict:
        """Return current Agent Booster metrics as a dictionary."""
        return self.metrics.to_dict()


# Module-level singleton
_detector: FastPIIDetector | None = None


def get_fast_pii_detector() -> FastPIIDetector:
    """Get or create the singleton FastPIIDetector."""
    global _detector
    if _detector is None:
        _detector = FastPIIDetector()
    return _detector
