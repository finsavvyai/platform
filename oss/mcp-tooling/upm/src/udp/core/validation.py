"""
Robust validation utilities for UPM.

Provides type-safe validation, sanitization, and error handling.
"""

import logging
import re
from datetime import datetime
from email.utils import parseaddr
from typing import Any, Optional, TypeVar, Union
from uuid import UUID

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ValidationResult:
    """Result of a validation operation."""

    def __init__(self, is_valid: bool, errors: Optional[list[str]] = None):
        self.is_valid = is_valid
        self.errors = errors or []

    def __bool__(self) -> bool:
        return self.is_valid

    def __repr__(self) -> str:
        return f"ValidationResult(is_valid={self.is_valid}, errors={self.errors})"


class EmailValidator:
    """Email validation utility."""

    # RFC 5322 compliant email regex (simplified)
    EMAIL_PATTERN = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )

    @classmethod
    def validate(cls, email: str) -> ValidationResult:
        """Validate email address."""
        if not email or not isinstance(email, str):
            return ValidationResult(False, ["Email must be a non-empty string"])

        email = email.strip().lower()

        if not cls.EMAIL_PATTERN.match(email):
            return ValidationResult(False, ["Invalid email format"])

        # Additional check using parseaddr
        name, addr = parseaddr(email)
        if not addr or addr != email:
            return ValidationResult(False, ["Invalid email address"])

        # Check length limits (RFC 5321)
        if len(email) > 254:
            return ValidationResult(False, ["Email address too long (max 254 characters)"])

        return ValidationResult(True)

    @classmethod
    def sanitize(cls, email: str) -> str:
        """Sanitize email address."""
        if not email:
            return ""
        return email.strip().lower()


class UUIDValidator:
    """UUID validation utility."""

    @classmethod
    def validate(cls, uuid_str: str) -> ValidationResult:
        """Validate UUID string."""
        if not uuid_str or not isinstance(uuid_str, str):
            return ValidationResult(False, ["UUID must be a non-empty string"])

        try:
            UUID(uuid_str)
            return ValidationResult(True)
        except ValueError:
            return ValidationResult(False, ["Invalid UUID format"])

    @classmethod
    def validate_list(cls, uuid_list: list[str]) -> ValidationResult:
        """Validate list of UUIDs."""
        errors = []
        for i, uuid_str in enumerate(uuid_list):
            result = cls.validate(uuid_str)
            if not result:
                errors.append(f"Invalid UUID at index {i}: {uuid_str}")

        return ValidationResult(len(errors) == 0, errors)


class StringValidator:
    """String validation utility."""

    @classmethod
    def validate_length(
        cls,
        value: str,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        field_name: str = "String"
    ) -> ValidationResult:
        """Validate string length."""
        if not isinstance(value, str):
            return ValidationResult(False, [f"{field_name} must be a string"])

        errors = []

        if min_length is not None and len(value) < min_length:
            errors.append(f"{field_name} must be at least {min_length} characters")

        if max_length is not None and len(value) > max_length:
            errors.append(f"{field_name} must be at most {max_length} characters")

        return ValidationResult(len(errors) == 0, errors)

    @classmethod
    def sanitize(cls, value: str, max_length: Optional[int] = None) -> str:
        """Sanitize string."""
        if not value:
            return ""

        # Remove leading/trailing whitespace
        value = value.strip()

        # Remove null bytes
        value = value.replace('\x00', '')

        # Truncate if needed
        if max_length and len(value) > max_length:
            value = value[:max_length]

        return value

    @classmethod
    def validate_alphanumeric(cls, value: str, allow_spaces: bool = False) -> ValidationResult:
        """Validate alphanumeric string."""
        if not isinstance(value, str):
            return ValidationResult(False, ["Value must be a string"])

        pattern = r'^[a-zA-Z0-9]+$' if not allow_spaces else r'^[a-zA-Z0-9\s]+$'

        if not re.match(pattern, value):
            return ValidationResult(False, ["Value must contain only alphanumeric characters"])

        return ValidationResult(True)


class NumberValidator:
    """Number validation utility."""

    @classmethod
    def validate_range(
        cls,
        value: Union[int, float],
        min_value: Optional[Union[int, float]] = None,
        max_value: Optional[Union[int, float]] = None,
        field_name: str = "Number"
    ) -> ValidationResult:
        """Validate number range."""
        if not isinstance(value, (int, float)):
            return ValidationResult(False, [f"{field_name} must be a number"])

        errors = []

        if min_value is not None and value < min_value:
            errors.append(f"{field_name} must be at least {min_value}")

        if max_value is not None and value > max_value:
            errors.append(f"{field_name} must be at most {max_value}")

        return ValidationResult(len(errors) == 0, errors)

    @classmethod
    def validate_positive(cls, value: Union[int, float], field_name: str = "Number") -> ValidationResult:
        """Validate positive number."""
        return cls.validate_range(value, min_value=0, field_name=field_name)

    @classmethod
    def validate_percentage(cls, value: Union[int, float]) -> ValidationResult:
        """Validate percentage (0-100)."""
        return cls.validate_range(value, min_value=0, max_value=100, field_name="Percentage")


class URLValidator:
    """URL validation utility."""

    URL_PATTERN = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE
    )

    @classmethod
    def validate(cls, url: str) -> ValidationResult:
        """Validate URL."""
        if not url or not isinstance(url, str):
            return ValidationResult(False, ["URL must be a non-empty string"])

        url = url.strip()

        if not cls.URL_PATTERN.match(url):
            return ValidationResult(False, ["Invalid URL format"])

        # Check length
        if len(url) > 2048:
            return ValidationResult(False, ["URL too long (max 2048 characters)"])

        return ValidationResult(True)

    @classmethod
    def sanitize(cls, url: str) -> str:
        """Sanitize URL."""
        if not url:
            return ""
        return url.strip()


class DateValidator:
    """Date validation utility."""

    @classmethod
    def validate_iso_format(cls, date_str: str) -> ValidationResult:
        """Validate ISO 8601 date string."""
        if not date_str or not isinstance(date_str, str):
            return ValidationResult(False, ["Date must be a non-empty string"])

        try:
            datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return ValidationResult(True)
        except ValueError:
            return ValidationResult(False, ["Invalid ISO 8601 date format"])


class ListValidator:
    """List validation utility."""

    @classmethod
    def validate_length(
        cls,
        value: list[Any],
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        field_name: str = "List"
    ) -> ValidationResult:
        """Validate list length."""
        if not isinstance(value, list):
            return ValidationResult(False, [f"{field_name} must be a list"])

        errors = []

        if min_length is not None and len(value) < min_length:
            errors.append(f"{field_name} must have at least {min_length} items")

        if max_length is not None and len(value) > max_length:
            errors.append(f"{field_name} must have at most {max_length} items")

        return ValidationResult(len(errors) == 0, errors)

    @classmethod
    def validate_unique(cls, value: list[Any], field_name: str = "List") -> ValidationResult:
        """Validate list contains unique items."""
        if not isinstance(value, list):
            return ValidationResult(False, [f"{field_name} must be a list"])

        if len(value) != len(set(value)):
            return ValidationResult(False, [f"{field_name} must contain unique items"])

        return ValidationResult(True)


def safe_parse_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Safely parse integer with default fallback."""
    try:
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            return int(value)
        return default
    except (ValueError, TypeError):
        return default


def safe_parse_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely parse float with default fallback."""
    try:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            return float(value)
        return default
    except (ValueError, TypeError):
        return default


def safe_parse_bool(value: Any, default: Optional[bool] = None) -> Optional[bool]:
    """Safely parse boolean with default fallback."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    if isinstance(value, int):
        return bool(value)
    return default


def validate_and_sanitize_dict(
    data: dict[str, Any],
    schema: dict[str, Any],
    strict: bool = False
) -> tuple[dict[str, Any], list[str]]:
    """
    Validate and sanitize dictionary against schema.

    Args:
        data: Dictionary to validate
        schema: Validation schema with field types and validators
        strict: If True, remove fields not in schema

    Returns:
        Tuple of (sanitized_data, errors)
    """
    sanitized = {}
    errors = []

    # Validate required fields
    for field_name, field_config in schema.items():
        is_required = field_config.get('required', False)
        field_type = field_config.get('type')
        validator_func = field_config.get('validator')

        if field_name not in data:
            if is_required:
                errors.append(f"Required field missing: {field_name}")
            continue

        value = data[field_name]

        # Type validation
        if field_type and not isinstance(value, field_type):
            errors.append(f"Field '{field_name}' must be of type {field_type.__name__}")
            continue

        # Custom validator
        if validator_func:
            result = validator_func(value)
            if not result:
                errors.extend([f"{field_name}: {err}" for err in result.errors])
                continue

        # Sanitize if sanitizer provided
        sanitizer = field_config.get('sanitizer')
        if sanitizer:
            value = sanitizer(value)

        sanitized[field_name] = value

    # Remove extra fields if strict
    if strict:
        sanitized = {k: v for k, v in sanitized.items() if k in schema}

    return sanitized, errors
