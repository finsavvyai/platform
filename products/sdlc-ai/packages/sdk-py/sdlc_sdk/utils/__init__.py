"""
Utility functions for SDLC.ai SDK

Provides helper functions for encryption, validation, logging,
and other common operations.
"""

from .encryption import encrypt_data, decrypt_data, generate_key
from .validation import validate_email, validate_url, sanitize_input
from .logging import get_logger, log_request, log_response
from .retry import retry_with_backoff, is_retryable_error
from .pagination import paginate, handle_pagination
from .streaming import stream_download, stream_upload
from .token import decode_token, is_token_expired, extract_token_info

__all__ = [
    # Encryption
    "encrypt_data",
    "decrypt_data",
    "generate_key",
    # Validation
    "validate_email",
    "validate_url",
    "sanitize_input",
    # Logging
    "get_logger",
    "log_request",
    "log_response",
    # Retry logic
    "retry_with_backoff",
    "is_retryable_error",
    # Pagination
    "paginate",
    "handle_pagination",
    # Streaming
    "stream_download",
    "stream_upload",
    # Token handling
    "decode_token",
    "is_token_expired",
    "extract_token_info",
]
