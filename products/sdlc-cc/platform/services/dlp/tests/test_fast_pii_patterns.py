"""Tests for fast_pii_patterns. These are the deterministic patterns the
Agent Booster uses before invoking the LLM/NER fallback. Coverage here is
security-critical: a regex that misses valid PII leaks data, and one that
over-matches adds noise.
"""

from __future__ import annotations

import re

import pytest

from app.services.fast_pii_patterns import (
    AMBIGUITY_SIGNALS,
    FAST_PII_PATTERNS,
    PIIMatch,
    PIIPatternDef,
    PIIType,
    _build_patterns,
    luhn_check,
    validate_ip_range,
)

# ─── PIIMatch dataclass ──────────────────────────────────────────────────

def test_pii_match_autofills_redacted_label():
    m = PIIMatch(pii_type=PIIType.EMAIL, start=0, end=5, matched_text="a@b.c", confidence=0.9)
    assert m.redacted_label == "[REDACTED_EMAIL]"


def test_pii_match_preserves_custom_label():
    m = PIIMatch(
        pii_type=PIIType.SSN, start=0, end=11, matched_text="123-45-6789",
        confidence=0.95, redacted_label="[SSN]",
    )
    assert m.redacted_label == "[SSN]"


# ─── Pattern inventory ────────────────────────────────────────────────────

def test_all_expected_types_have_a_pattern():
    types = {p.pii_type for p in FAST_PII_PATTERNS}
    assert types == {
        PIIType.EMAIL, PIIType.PHONE, PIIType.SSN,
        PIIType.CREDIT_CARD, PIIType.IP_ADDRESS, PIIType.DATE_OF_BIRTH,
    }


def test_build_patterns_returns_fresh_list():
    a = _build_patterns()
    b = _build_patterns()
    assert a is not b
    assert len(a) == len(b)


def test_each_pattern_has_nonzero_confidence():
    for p in FAST_PII_PATTERNS:
        assert 0.0 < p.confidence <= 1.0


# ─── Email ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "contact: alice@example.com",
    "Reach me at user.name+tag@company.co.uk today",
    "bob_99@sub.example.org",
])
def test_email_pattern_matches_valid(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.EMAIL)
    assert pattern.search(text) is not None


@pytest.mark.parametrize("text", [
    "not an email @ symbol only",
    "missing-tld@example",
    "plain text",
])
def test_email_pattern_rejects_invalid(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.EMAIL)
    assert pattern.search(text) is None


# ─── Phone ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "call 555-123-4567",
    "(555) 123-4567",
    "+1 555.123.4567",
    "5551234567",
])
def test_phone_pattern_matches_us_formats(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.PHONE)
    assert pattern.search(text) is not None


def test_phone_pattern_ignores_too_short():
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.PHONE)
    assert pattern.search("call 12345") is None


# ─── SSN ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "SSN: 123-45-6789",
    "Ref 111-22-3333 filed",
])
def test_ssn_pattern_matches_valid(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.SSN)
    assert pattern.search(text) is not None


@pytest.mark.parametrize("text", [
    "000-12-3456",   # area 000 is reserved
    "666-12-3456",   # area 666 is reserved
    "900-12-3456",   # area 9xx is reserved
    "123-00-4567",   # group 00 invalid
    "123-45-0000",   # serial 0000 invalid
])
def test_ssn_pattern_rejects_reserved(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.SSN)
    assert pattern.search(text) is None


# ─── Credit card ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "pay 4111 1111 1111 1111 now",   # Visa
    "card 5500-0000-0000-0004",       # MasterCard
    "card 6011 1234 5678 9012",       # Discover
])
def test_credit_card_pattern_matches(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.CREDIT_CARD)
    assert pattern.search(text) is not None


def test_credit_card_pattern_rejects_random_digits():
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.CREDIT_CARD)
    # leading 7 is not a valid major issuer
    assert pattern.search("7000 0000 0000 0000") is None


# ─── IP address ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "client 10.0.0.1 connected",
    "192.168.1.100",
    "255.255.255.255",
])
def test_ip_pattern_matches(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.IP_ADDRESS)
    assert pattern.search(text) is not None


@pytest.mark.parametrize("text", [
    "999.1.2.3",
    "256.256.256.256",
    "1.2.3",
])
def test_ip_pattern_rejects_invalid(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.IP_ADDRESS)
    assert pattern.search(text) is None


# ─── Date of birth ────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "DOB: 01/15/1980",
    "date of birth 1-5-1990",
    "Born: 12/25/1975",
])
def test_dob_pattern_matches(text):
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.DATE_OF_BIRTH)
    assert pattern.search(text) is not None


def test_dob_pattern_is_case_insensitive():
    pattern = next(p.pattern for p in FAST_PII_PATTERNS if p.pii_type == PIIType.DATE_OF_BIRTH)
    assert pattern.search("dob: 1/1/2000") is not None


# ─── Ambiguity signals ────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "the user is known as johnny",
    "she lives in portland",
    "his passport number is ABC123",
    "driver's license number",
])
def test_ambiguity_signals_fire_for_freeform_pii(text):
    assert AMBIGUITY_SIGNALS.search(text) is not None


def test_ambiguity_signals_skip_structured_text():
    assert AMBIGUITY_SIGNALS.search("SSN 123-45-6789 on file") is None


# ─── Luhn check ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("num,expected", [
    ("4111111111111111", True),        # Visa test number
    ("5500000000000004", True),        # MasterCard test number
    ("340000000000009", True),         # Amex test number
    ("4111111111111112", False),       # bad checksum
    ("1234567890123456", False),
    ("123", False),                    # too short
])
def test_luhn_check(num, expected):
    assert luhn_check(num) is expected


def test_luhn_ignores_non_digits():
    # Same Visa test number with separators
    assert luhn_check("4111-1111-1111-1111") is True


# ─── IP range validator ───────────────────────────────────────────────────

@pytest.mark.parametrize("ip,expected", [
    ("10.0.0.1", True),
    ("192.168.1.1", True),
    ("8.8.8.8", True),
    ("127.0.0.1", False),    # loopback
    ("0.0.0.0", False),      # any
    ("255.255.255.255", False),  # broadcast
    ("224.0.0.1", False),    # multicast
])
def test_validate_ip_range(ip, expected):
    assert validate_ip_range(ip) is expected


# ─── End-to-end sanity via dataclass API ─────────────────────────────────

def test_pattern_def_is_immutable_in_spirit():
    p = PIIPatternDef(
        pii_type=PIIType.EMAIL,
        pattern=re.compile(r"x"),
        confidence=0.5,
    )
    assert p.validator == ""
    assert p.pii_type == PIIType.EMAIL
