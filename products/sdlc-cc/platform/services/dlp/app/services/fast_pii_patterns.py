"""
Agent Booster: Fast PII Pattern Definitions.

Deterministic regex patterns for sub-millisecond PII detection.
These patterns handle unambiguous, well-structured PII formats
without requiring LLM or ML inference.
"""

import re
import sys
from dataclasses import dataclass
from re import Pattern

# Python 3.11 introduced enum.StrEnum. Keep a narrow back-compat shim so
# the module imports on 3.9/3.10 runners (pytest CLI, local dev) even
# though the service target is 3.11+.
if sys.version_info >= (3, 11):
    from enum import StrEnum
else:  # pragma: no cover - only exercised on <3.11
    from enum import Enum

    class StrEnum(str, Enum):
        """Minimal StrEnum shim for 3.9/3.10."""


class PIIType(StrEnum):
    """PII entity types handled by the fast detector."""

    EMAIL = "EMAIL"
    PHONE = "PHONE"
    SSN = "SSN"
    CREDIT_CARD = "CREDIT_CARD"
    IP_ADDRESS = "IP_ADDRESS"
    DATE_OF_BIRTH = "DATE_OF_BIRTH"


@dataclass
class PIIMatch:
    """Result of a single PII match."""

    pii_type: PIIType
    start: int
    end: int
    matched_text: str
    confidence: float
    redacted_label: str = ""

    def __post_init__(self):
        if not self.redacted_label:
            self.redacted_label = f"[REDACTED_{self.pii_type.value}]"


@dataclass
class PIIPatternDef:
    """Definition for a compiled PII pattern."""

    pii_type: PIIType
    pattern: Pattern
    confidence: float
    validator: str = ""


def _build_patterns() -> list[PIIPatternDef]:
    """Build and compile all fast-path PII patterns."""
    return [
        PIIPatternDef(
            pii_type=PIIType.EMAIL,
            pattern=re.compile(
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
            ),
            confidence=0.95,
        ),
        PIIPatternDef(
            pii_type=PIIType.PHONE,
            pattern=re.compile(
                r"\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b"
            ),
            confidence=0.90,
        ),
        PIIPatternDef(
            pii_type=PIIType.SSN,
            pattern=re.compile(
                r"\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b"
            ),
            confidence=0.95,
            validator="luhn_ssn",
        ),
        PIIPatternDef(
            pii_type=PIIType.CREDIT_CARD,
            pattern=re.compile(
                r"\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))"
                r"[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}\b"
            ),
            confidence=0.90,
            validator="luhn",
        ),
        PIIPatternDef(
            pii_type=PIIType.IP_ADDRESS,
            pattern=re.compile(
                r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
                r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
            ),
            confidence=0.85,
            validator="ip_range",
        ),
        PIIPatternDef(
            pii_type=PIIType.DATE_OF_BIRTH,
            pattern=re.compile(
                r"\b(?:DOB|Date of Birth|Born|Birthday|D\.O\.B\.?)"
                r"[:\s]+\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b",
                re.IGNORECASE,
            ),
            confidence=0.90,
        ),
    ]


# Pre-built patterns (compiled once at module load)
FAST_PII_PATTERNS: list[PIIPatternDef] = _build_patterns()

# Ambiguity indicators: if text contains these, fall back to LLM
AMBIGUITY_SIGNALS = re.compile(
    r"(?:"
    r"(?:name|called|known as)\s+\w+"  # Person names need NER
    r"|(?:lives?\s+(?:in|at|on))"  # Addresses need NER
    r"|(?:passport\s+(?:number|no\.?|#))"  # Passport formats vary
    r"|(?:driver'?s?\s+licen[sc]e)"  # License formats vary
    r")",
    re.IGNORECASE,
)


def luhn_check(number_str: str) -> bool:
    """Validate a number string using the Luhn algorithm."""
    digits = [int(d) for d in number_str if d.isdigit()]
    if len(digits) < 13:
        return False
    checksum = 0
    for i, digit in enumerate(reversed(digits)):
        if i % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def validate_ip_range(ip_str: str) -> bool:
    """Check that an IP is not a common non-PII address."""
    non_pii_prefixes = ("0.", "127.", "255.", "224.")
    return not ip_str.startswith(non_pii_prefixes)
