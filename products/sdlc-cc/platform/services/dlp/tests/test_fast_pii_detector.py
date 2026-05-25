"""
Tests for Agent Booster FastPIIDetector.

Covers detection accuracy, masking, can_handle logic,
Luhn validation, and metrics tracking.
"""

import os

import pytest

from app.services.fast_pii_detector import FastPIIDetector
from app.services.fast_pii_patterns import (
    PIIType,
    luhn_check,
    validate_ip_range,
)


@pytest.fixture
def detector():
    """Create an enabled FastPIIDetector for testing."""
    return FastPIIDetector(enabled=True)


@pytest.fixture
def disabled_detector():
    """Create a disabled FastPIIDetector."""
    return FastPIIDetector(enabled=False)


# --- Email detection ---

def test_detect_email(detector):
    matches = detector.detect("Contact us at john@example.com today")
    assert len(matches) == 1
    assert matches[0].pii_type == PIIType.EMAIL
    assert matches[0].matched_text == "john@example.com"
    assert matches[0].confidence >= 0.9


def test_detect_multiple_emails(detector):
    text = "Send to a@b.com and c@d.org"
    matches = detector.detect(text)
    emails = [m for m in matches if m.pii_type == PIIType.EMAIL]
    assert len(emails) == 2


# --- Phone detection ---

def test_detect_us_phone(detector):
    matches = detector.detect("Call 555-123-4567 for info")
    phones = [m for m in matches if m.pii_type == PIIType.PHONE]
    assert len(phones) == 1
    assert "555-123-4567" in phones[0].matched_text


def test_detect_phone_with_parens(detector):
    matches = detector.detect("Phone: (555) 123-4567")
    phones = [m for m in matches if m.pii_type == PIIType.PHONE]
    assert len(phones) == 1


# --- SSN detection ---

def test_detect_ssn(detector):
    matches = detector.detect("SSN: 123-45-6789")
    ssns = [m for m in matches if m.pii_type == PIIType.SSN]
    assert len(ssns) == 1
    assert ssns[0].matched_text == "123-45-6789"


def test_reject_invalid_ssn(detector):
    # SSN starting with 000 should not match
    matches = detector.detect("Number: 000-12-3456")
    ssns = [m for m in matches if m.pii_type == PIIType.SSN]
    assert len(ssns) == 0


# --- Credit card detection ---

def test_detect_visa(detector):
    # Valid Visa number that passes Luhn
    matches = detector.detect("Card: 4111-1111-1111-1111")
    cards = [m for m in matches if m.pii_type == PIIType.CREDIT_CARD]
    assert len(cards) == 1


def test_reject_invalid_credit_card(detector):
    # Invalid Luhn
    matches = detector.detect("Card: 4111-1111-1111-1112")
    cards = [m for m in matches if m.pii_type == PIIType.CREDIT_CARD]
    assert len(cards) == 0


# --- IP address detection ---

def test_detect_ip(detector):
    matches = detector.detect("Server at 192.168.1.100")
    ips = [m for m in matches if m.pii_type == PIIType.IP_ADDRESS]
    assert len(ips) == 1
    assert ips[0].matched_text == "192.168.1.100"


def test_reject_localhost_ip(detector):
    matches = detector.detect("Localhost: 127.0.0.1")
    ips = [m for m in matches if m.pii_type == PIIType.IP_ADDRESS]
    assert len(ips) == 0


def test_reject_invalid_ip_octets(detector):
    matches = detector.detect("Bad IP: 999.999.999.999")
    ips = [m for m in matches if m.pii_type == PIIType.IP_ADDRESS]
    assert len(ips) == 0


# --- Date of birth detection ---

def test_detect_dob(detector):
    matches = detector.detect("DOB: 01/15/1990")
    dobs = [m for m in matches if m.pii_type == PIIType.DATE_OF_BIRTH]
    assert len(dobs) == 1


def test_detect_dob_verbose(detector):
    matches = detector.detect("Date of Birth: 03-25-1985")
    dobs = [m for m in matches if m.pii_type == PIIType.DATE_OF_BIRTH]
    assert len(dobs) == 1


# --- Masking ---

def test_mask_email(detector):
    text = "Email: john@example.com"
    matches = detector.detect(text)
    masked = detector.mask(text, matches)
    assert "john@example.com" not in masked
    assert "[REDACTED_EMAIL]" in masked


def test_mask_multiple_types(detector):
    text = "SSN: 123-45-6789, Email: a@b.com"
    matches = detector.detect(text)
    masked = detector.mask(text, matches)
    assert "123-45-6789" not in masked
    assert "a@b.com" not in masked
    assert "[REDACTED_SSN]" in masked
    assert "[REDACTED_EMAIL]" in masked


def test_mask_preserves_non_pii(detector):
    text = "Hello world, no PII here"
    matches = detector.detect(text)
    masked = detector.mask(text, matches)
    assert masked == text


def test_detect_and_mask(detector):
    text = "Call 555-123-4567"
    masked, matches = detector.detect_and_mask(text)
    assert len(matches) >= 1
    assert "555-123-4567" not in masked


# --- can_handle ---

def test_can_handle_simple_pii(detector):
    assert detector.can_handle("Email: a@b.com, SSN: 123-45-6789")


def test_cannot_handle_person_names(detector):
    assert not detector.can_handle("His name is John Smith")


def test_cannot_handle_addresses(detector):
    assert not detector.can_handle("She lives in New York")


def test_cannot_handle_passports(detector):
    assert not detector.can_handle("passport number ABC123")


# --- Disabled detector ---

def test_disabled_returns_empty(disabled_detector):
    assert disabled_detector.detect("SSN: 123-45-6789") == []


def test_disabled_can_handle_false(disabled_detector):
    assert not disabled_detector.can_handle("anything")


# --- Validators ---

def test_luhn_valid():
    assert luhn_check("4111111111111111") is True


def test_luhn_invalid():
    assert luhn_check("4111111111111112") is False


def test_luhn_short():
    assert luhn_check("1234") is False


def test_validate_ip_normal():
    assert validate_ip_range("192.168.1.1") is True


def test_validate_ip_localhost():
    assert validate_ip_range("127.0.0.1") is False


def test_validate_ip_broadcast():
    assert validate_ip_range("255.255.255.255") is False


# --- Metrics ---

def test_metrics_recorded(detector):
    detector.detect("Email: a@b.com")
    metrics = detector.get_metrics()
    booster = metrics["agent_booster"]
    assert booster["fast_path_count"] == 1
    assert booster["total_requests"] == 1
    assert booster["fast_path_ratio"] == 1.0
    assert "EMAIL" in booster["pattern_hit_counts"]


def test_env_default_disabled():
    """Without env var, detector defaults to disabled."""
    old = os.environ.pop("AGENT_BOOSTER_ENABLED", None)
    try:
        d = FastPIIDetector()
        assert not d.enabled
    finally:
        if old is not None:
            os.environ["AGENT_BOOSTER_ENABLED"] = old


def test_env_enabled():
    """With env var set, detector is enabled."""
    os.environ["AGENT_BOOSTER_ENABLED"] = "true"
    try:
        d = FastPIIDetector()
        assert d.enabled
    finally:
        del os.environ["AGENT_BOOSTER_ENABLED"]
