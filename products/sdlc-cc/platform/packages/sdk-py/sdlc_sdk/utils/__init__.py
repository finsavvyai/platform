"""
Utility functions for SDLC.ai SDK

Provides helper functions for encryption, validation, logging,
and other common operations.
"""

from .encryption import decrypt_data, encrypt_data, generate_key
from .logging import get_logger, log_request, log_response
from .pagination import handle_pagination, paginate
from .retry import is_retryable_error, retry_with_backoff
from .streaming import stream_download, stream_upload
from .token import decode_token, extract_token_info, is_token_expired
from .validation import sanitize_input, validate_email, validate_url

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
