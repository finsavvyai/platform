"""
Core schemas for Universal Dependency Platform.
"""

from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseModel(BaseModel):
    """Standard API response wrapper."""

    success: bool = True
    message: str = "OK"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None


class PaginatedResponse(BaseModel):
    """Paginated API response wrapper."""

    items: List[Any] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 0


__all__ = ["ResponseModel", "PaginatedResponse"]
