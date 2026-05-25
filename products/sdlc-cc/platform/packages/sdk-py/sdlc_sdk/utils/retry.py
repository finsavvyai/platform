"""
Retry utilities for SDLC.ai SDK

Provides retry logic with exponential backoff for resilient operations.
"""

import random
import time
from functools import wraps
from typing import Any, Callable, Optional

import structlog

from ..exceptions import (
    NetworkError,
    RateLimitError,
    ServerError,
    TimeoutError,
    is_retryable_error,
)

logger = structlog.get_logger("sdlc_sdk.retry")


def retry_with_backoff(
    max_retries: int = 3,
    backoff_factor: float = 1.0,
    backoff_max: float = 60.0,
    jitter: bool = True,
    retryable_exceptions: Optional[tuple[type[Exception], ...]] = None,
):
    """
    Decorator for retrying functions with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        backoff_factor: Base factor for backoff calculation
        backoff_max: Maximum backoff time in seconds
        jitter: Whether to add random jitter to backoff
        retryable_exceptions: Tuple of exceptions that are retryable
    """
    if retryable_exceptions is None:
        retryable_exceptions = (
            NetworkError,
            TimeoutError,
            RateLimitError,
            ServerError,
        )

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == max_retries:
                        logger.error(
                            "Max retries exceeded",
                            function=func.__name__,
                            attempts=attempt + 1,
                            error=str(e),
                        )
                        raise

                    # Calculate backoff time
                    if isinstance(e, RateLimitError) and e.retry_after:
                        backoff_time = e.retry_after
                    else:
                        backoff_time = min(backoff_factor * (2**attempt), backoff_max)

                    # Add jitter if enabled
                    if jitter:
                        backoff_time *= 0.5 + random.random() * 0.5

                    logger.warning(
                        "Retrying operation",
                        function=func.__name__,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        backoff_seconds=backoff_time,
                        error=str(e),
                    )

                    time.sleep(backoff_time)
                except Exception as e:
                    # Non-retryable exception, re-raise immediately
                    logger.error(
                        "Non-retryable error",
                        function=func.__name__,
                        error=str(e),
                        error_type=type(e).__name__,
                    )
                    raise

            # This should never be reached
            if last_exception:
                raise last_exception

        return wrapper

    return decorator


async def async_retry_with_backoff(
    max_retries: int = 3,
    backoff_factor: float = 1.0,
    backoff_max: float = 60.0,
    jitter: bool = True,
    retryable_exceptions: Optional[tuple[type[Exception], ...]] = None,
):
    """
    Async decorator for retrying functions with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts
        backoff_factor: Base factor for backoff calculation
        backoff_max: Maximum backoff time in seconds
        jitter: Whether to add random jitter to backoff
        retryable_exceptions: Tuple of exceptions that are retryable
    """
    import asyncio

    if retryable_exceptions is None:
        retryable_exceptions = (
            NetworkError,
            TimeoutError,
            RateLimitError,
            ServerError,
        )

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == max_retries:
                        logger.error(
                            "Max retries exceeded",
                            function=func.__name__,
                            attempts=attempt + 1,
                            error=str(e),
                        )
                        raise

                    # Calculate backoff time
                    if isinstance(e, RateLimitError) and e.retry_after:
                        backoff_time = e.retry_after
                    else:
                        backoff_time = min(backoff_factor * (2**attempt), backoff_max)

                    # Add jitter if enabled
                    if jitter:
                        backoff_time *= 0.5 + random.random() * 0.5

                    logger.warning(
                        "Retrying async operation",
                        function=func.__name__,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        backoff_seconds=backoff_time,
                        error=str(e),
                    )

                    await asyncio.sleep(backoff_time)
                except Exception as e:
                    # Non-retryable exception, re-raise immediately
                    logger.error(
                        "Non-retryable error",
                        function=func.__name__,
                        error=str(e),
                        error_type=type(e).__name__,
                    )
                    raise

            # This should never be reached
            if last_exception:
                raise last_exception

        return wrapper

    return decorator


def is_retryable_error(error: Exception) -> bool:
    """
    Check if an error is retryable based on its type and properties.

    Args:
        error: Exception to check

    Returns:
        True if the error is retryable
    """
    # Check explicit retryable types
    if isinstance(error, (NetworkError, TimeoutError, ServerError)):
        return True

    # Check rate limit with retry-after
    if isinstance(error, RateLimitError) and error.retry_after:
        return True

    # Check for specific status codes that should be retried
    if hasattr(error, "status_code"):
        retryable_codes = {429, 500, 502, 503, 504}
        if error.status_code in retryable_codes:
            return True

    return False


def calculate_backoff(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    exponential_base: float = 2.0,
) -> float:
    """
    Calculate backoff delay for a given attempt number.

    Args:
        attempt: Attempt number (0-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        jitter: Whether to add random jitter
        exponential_base: Base for exponential backoff

    Returns:
        Calculated delay in seconds
    """
    delay = min(base_delay * (exponential_base**attempt), max_delay)

    if jitter:
        # Add random jitter between 0.5x and 1.5x the delay
        delay *= 0.5 + random.random()

    return delay


class RetryState:
    """State holder for retry operations."""

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter: bool = True,
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
        self.attempts = 0
        self.total_delay = 0.0
        self.last_error: Optional[Exception] = None

    def should_retry(self, error: Exception) -> bool:
        """Check if operation should be retried."""
        self.attempts += 1
        self.last_error = error

        if self.attempts > self.max_attempts:
            return False

        return is_retryable_error(error)

    def get_delay(self) -> float:
        """Get delay for next retry."""
        delay = calculate_backoff(
            attempt=self.attempts - 1,
            base_delay=self.base_delay,
            max_delay=self.max_delay,
            jitter=self.jitter,
        )
        self.total_delay += delay
        return delay

    def reset(self) -> None:
        """Reset retry state."""
        self.attempts = 0
        self.total_delay = 0.0
        self.last_error = None
