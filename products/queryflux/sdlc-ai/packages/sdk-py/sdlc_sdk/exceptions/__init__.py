"""
Exception module for SDLC.ai SDK

Provides a comprehensive exception hierarchy for different error types
with detailed error messages and suggested solutions.
"""

from typing import Optional, Dict, Any, List
import json


class SDLCError(Exception):
    """Base exception for all SDLC.ai SDK errors."""

    def __init__(
        self,
        message: str,
        code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        suggestion: Optional[str] = None,
        request_id: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}
        self.suggestion = suggestion
        self.request_id = request_id

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging."""
        return {
            "error_type": self.__class__.__name__,
            "message": self.message,
            "code": self.code,
            "details": self.details,
            "suggestion": self.suggestion,
            "request_id": self.request_id,
        }

    def __str__(self) -> str:
        msg = self.message
        if self.code:
            msg = f"[{self.code}] {msg}"
        if self.suggestion:
            msg += f"\nSuggestion: {self.suggestion}"
        return msg


class AuthenticationError(SDLCError):
    """Raised when authentication fails."""

    def __init__(
        self,
        message: str = "Authentication failed",
        code: Optional[str] = "AUTH_FAILED",
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check your API credentials and ensure they are valid and not expired",
            **kwargs,
        )


class AuthorizationError(SDLCError):
    """Raised when the user doesn't have permission to perform an action."""

    def __init__(
        self,
        message: str = "Access denied",
        code: Optional[str] = "ACCESS_DENIED",
        required_permissions: Optional[List[str]] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Ensure you have the necessary permissions to perform this action",
            **kwargs,
        )
        self.required_permissions = required_permissions or []


class ValidationError(SDLCError):
    """Raised when request validation fails."""

    def __init__(
        self,
        message: str = "Validation failed",
        code: Optional[str] = "VALIDATION_FAILED",
        errors: Optional[List[Dict[str, Any]]] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the request data and ensure it matches the expected format",
            **kwargs,
        )
        self.errors = errors or []


class RateLimitError(SDLCError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        code: Optional[str] = "RATE_LIMITED",
        retry_after: Optional[int] = None,
        limit: Optional[int] = None,
        current: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion=f"Wait {retry_after or 60} seconds before making another request",
            **kwargs,
        )
        self.retry_after = retry_after
        self.limit = limit
        self.current = current


class NetworkError(SDLCError):
    """Raised when network operations fail."""

    def __init__(
        self,
        message: str = "Network error occurred",
        code: Optional[str] = "NETWORK_ERROR",
        underlying_error: Optional[Exception] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check your network connection and try again",
            **kwargs,
        )
        self.underlying_error = underlying_error


class TimeoutError(SDLCError):
    """Raised when a request times out."""

    def __init__(
        self,
        message: str = "Request timed out",
        code: Optional[str] = "TIMEOUT",
        timeout: Optional[float] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion=f"Increase the timeout value or check if the server is responding",
            **kwargs,
        )
        self.timeout = timeout


class NotFoundError(SDLCError):
    """Raised when a resource is not found."""

    def __init__(
        self,
        message: str = "Resource not found",
        code: Optional[str] = "NOT_FOUND",
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Verify the resource ID exists and you have access to it",
            **kwargs,
        )
        self.resource_type = resource_type
        self.resource_id = resource_id


class ConflictError(SDLCError):
    """Raised when a resource conflict occurs."""

    def __init__(
        self,
        message: str = "Resource conflict",
        code: Optional[str] = "CONFLICT",
        conflict_type: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="The resource state has changed, please refresh and try again",
            **kwargs,
        )
        self.conflict_type = conflict_type


class ServerError(SDLCError):
    """Raised when the server returns an error."""

    def __init__(
        self,
        message: str = "Server error occurred",
        code: Optional[str] = "SERVER_ERROR",
        status_code: Optional[int] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="The server encountered an error, please try again later",
            **kwargs,
        )
        self.status_code = status_code


class APIError(SDLCError):
    """General API error for unhandled cases."""

    def __init__(
        self,
        message: str = "API error occurred",
        code: Optional[str] = "API_ERROR",
        status_code: Optional[int] = None,
        response_data: Optional[Dict[str, Any]] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the API response and ensure your request is valid",
            **kwargs,
        )
        self.status_code = status_code
        self.response_data = response_data or {}


class ConfigurationError(SDLCError):
    """Raised when SDK configuration is invalid."""

    def __init__(
        self,
        message: str = "Configuration error",
        code: Optional[str] = "CONFIG_ERROR",
        config_key: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check your SDK configuration and ensure all required fields are set",
            **kwargs,
        )
        self.config_key = config_key


class TokenExpiredError(AuthenticationError):
    """Raised when the authentication token has expired."""

    def __init__(self, message: str = "Authentication token has expired", **kwargs):
        super().__init__(
            message=message,
            code="TOKEN_EXPIRED",
            suggestion="Refresh your authentication token or re-authenticate",
            **kwargs,
        )


class TokenInvalidError(AuthenticationError):
    """Raised when the authentication token is invalid."""

    def __init__(self, message: str = "Authentication token is invalid", **kwargs):
        super().__init__(
            message=message,
            code="TOKEN_INVALID",
            suggestion="Obtain a new authentication token",
            **kwargs,
        )


class DocumentProcessingError(SDLCError):
    """Raised when document processing fails."""

    def __init__(
        self,
        message: str = "Document processing failed",
        code: Optional[str] = "DOC_PROCESSING_ERROR",
        document_id: Optional[str] = None,
        stage: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the document format and ensure it's not corrupted",
            **kwargs,
        )
        self.document_id = document_id
        self.stage = stage


class RAGError(SDLCError):
    """Raised when RAG operations fail."""

    def __init__(
        self,
        message: str = "RAG operation failed",
        code: Optional[str] = "RAG_ERROR",
        operation: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the query format and ensure documents are indexed",
            **kwargs,
        )
        self.operation = operation


class PolicyError(SDLCError):
    """Raised when policy operations fail."""

    def __init__(
        self,
        message: str = "Policy operation failed",
        code: Optional[str] = "POLICY_ERROR",
        policy_id: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the policy syntax and ensure it follows the required format",
            **kwargs,
        )
        self.policy_id = policy_id


class EncryptionError(SDLCError):
    """Raised when encryption/decryption operations fail."""

    def __init__(
        self,
        message: str = "Encryption operation failed",
        code: Optional[str] = "ENCRYPTION_ERROR",
        operation: Optional[str] = None,
        **kwargs,
    ):
        super().__init__(
            message=message,
            code=code,
            suggestion="Check the encryption key and ensure it's valid",
            **kwargs,
        )
        self.operation = operation


# Map HTTP status codes to exceptions
STATUS_CODE_EXCEPTIONS = {
    400: ValidationError,
    401: AuthenticationError,
    403: AuthorizationError,
    404: NotFoundError,
    409: ConflictError,
    422: ValidationError,
    429: RateLimitError,
    500: ServerError,
    502: ServerError,
    503: ServerError,
    504: TimeoutError,
}


def exception_from_response(
    status_code: int, response_data: Optional[Dict[str, Any]] = None, **kwargs
) -> SDLCError:
    """
    Create appropriate exception from HTTP response.

    Args:
        status_code: HTTP status code
        response_data: Response body data
        **kwargs: Additional exception arguments

    Returns:
        SDLCError instance
    """
    response_data = response_data or {}

    # Extract error information from response
    error_code = response_data.get("code") or response_data.get("error_code")
    message = (
        response_data.get("message")
        or response_data.get("error")
        or "API error occurred"
    )
    details = response_data.get("details", {})
    suggestion = response_data.get("suggestion")

    # Get exception class for status code
    exc_class = STATUS_CODE_EXCEPTIONS.get(status_code, APIError)

    # Add status code to kwargs
    kwargs["status_code"] = status_code

    # Create exception with response data
    return exc_class(
        message=message,
        code=error_code,
        details=details,
        suggestion=suggestion,
        response_data=response_data,
        **kwargs,
    )
