"""
Robust error handling middleware for FastAPI.

Provides comprehensive error handling with proper status codes,
structured error responses, and logging.
"""

import logging
import traceback
from typing import Any, Optional
from uuid import uuid4

from fastapi import Request, status
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class ErrorResponse:
    """Structured error response model."""

    def __init__(
        self,
        error_code: str,
        message: str,
        details: Optional[dict[str, Any]] = None,
        request_id: Optional[str] = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        self.error_code = error_code
        self.message = message
        self.details = details or {}
        self.request_id = request_id
        self.status_code = status_code

    def to_dict(self) -> dict[str, Any]:
        """Convert error response to dictionary."""
        response = {
            "success": False,
            "error": {
                "code": self.error_code,
                "message": self.message,
                "request_id": self.request_id,
            }
        }

        if self.details:
            response["error"]["details"] = self.details

        return response


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive error handling middleware.

    Handles:
    - Validation errors
    - HTTP exceptions
    - Database errors
    - Generic exceptions
    - Provides structured error responses
    """

    async def dispatch(self, request: Request, call_next):
        """Process request and handle errors."""
        request_id = str(uuid4())

        try:
            response = await call_next(request)

            # Add request ID to successful responses
            if hasattr(response, "headers"):
                response.headers["X-Request-ID"] = request_id

            return response

        except RequestValidationError as e:
            logger.warning(f"Validation error: {e.errors()}")
            error_response = ErrorResponse(
                error_code="VALIDATION_ERROR",
                message="Request validation failed",
                details={"errors": e.errors()},
                request_id=request_id,
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except HTTPException as e:
            logger.info(f"HTTP exception: {e.status_code} - {e.detail}")
            error_response = ErrorResponse(
                error_code=f"HTTP_{e.status_code}",
                message=e.detail,
                request_id=request_id,
                status_code=e.status_code
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except IntegrityError as e:
            logger.error(f"Database integrity error: {str(e)}", exc_info=True)
            error_response = ErrorResponse(
                error_code="DATABASE_INTEGRITY_ERROR",
                message="Database integrity constraint violation",
                details={"original_error": str(e.orig) if hasattr(e, 'orig') else str(e)},
                request_id=request_id,
                status_code=status.HTTP_409_CONFLICT
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except SQLAlchemyError as e:
            logger.error(f"Database error: {str(e)}", exc_info=True)
            error_response = ErrorResponse(
                error_code="DATABASE_ERROR",
                message="Database operation failed",
                details={"error_type": type(e).__name__},
                request_id=request_id,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except ValidationError as e:
            logger.warning(f"Pydantic validation error: {e.errors()}")
            error_response = ErrorResponse(
                error_code="MODEL_VALIDATION_ERROR",
                message="Data model validation failed",
                details={"errors": e.errors()},
                request_id=request_id,
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except ValueError as e:
            logger.warning(f"Value error: {str(e)}")
            error_response = ErrorResponse(
                error_code="INVALID_VALUE",
                message=str(e),
                request_id=request_id,
                status_code=status.HTTP_400_BAD_REQUEST
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except KeyError as e:
            logger.warning(f"Key error: {str(e)}")
            error_response = ErrorResponse(
                error_code="MISSING_KEY",
                message=f"Required key missing: {str(e)}",
                request_id=request_id,
                status_code=status.HTTP_400_BAD_REQUEST
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except TypeError as e:
            logger.error(f"Type error: {str(e)}", exc_info=True)
            error_response = ErrorResponse(
                error_code="TYPE_ERROR",
                message="Invalid data type",
                details={"error": str(e)},
                request_id=request_id,
                status_code=status.HTTP_400_BAD_REQUEST
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )

        except Exception as e:
            # Log full traceback for unexpected errors
            logger.error(
                f"Unexpected error: {type(e).__name__}: {str(e)}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "path": request.url.path,
                    "method": request.method,
                }
            )

            # In production, don't expose internal error details
            from udp.core.config import settings

            error_message = "An unexpected error occurred"
            error_details = {}

            if settings.DEBUG:
                error_message = str(e)
                error_details = {
                    "type": type(e).__name__,
                    "traceback": traceback.format_exc().split("\n")
                }

            error_response = ErrorResponse(
                error_code="INTERNAL_SERVER_ERROR",
                message=error_message,
                details=error_details,
                request_id=request_id,
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            return JSONResponse(
                status_code=error_response.status_code,
                content=error_response.to_dict()
            )
