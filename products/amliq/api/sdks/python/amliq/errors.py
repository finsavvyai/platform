"""Error types for AMLIQ SDK."""


class AMLIQError(Exception):
    """Base error for all AMLIQ API errors."""
    pass


class AuthError(AMLIQError):
    """Raised when API key is invalid or missing."""
    pass


class RateLimitError(AMLIQError):
    """Raised when API rate limit is exceeded."""
    pass


class ValidationError(AMLIQError):
    """Raised when request validation fails."""
    pass
