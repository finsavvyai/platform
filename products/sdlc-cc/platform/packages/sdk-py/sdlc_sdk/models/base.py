"""
Base Pydantic models for SDLC.ai SDK

Provides common base classes and shared model functionality.
"""

from datetime import datetime
from typing import Any, Dict, Optional, Type, TypeVar, Union
from pydantic import BaseModel, Field, validator
from pydantic.generics import GenericModel

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    class Config:
        """Pydantic configuration."""

        allow_population_by_field_name = True
        validate_assignment = True
        use_enum_values = True
        extra = "forbid"
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class BaseModel(BaseSchema):
    """Base model with ID field."""

    id: str = Field(..., description="Unique identifier")

    class Config(BaseSchema.Config):
        """Model configuration."""

        pass


class TimestampModel(BaseModel):
    """Model with timestamp fields."""

    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow, description="Last update timestamp"
    )

    class Config(BaseSchema.Config):
        """Model configuration."""

        pass


class IDModel(BaseSchema):
    """Simple model with just an ID."""

    id: str = Field(..., description="Unique identifier")


class PaginationModel(BaseSchema):
    """Pagination metadata model."""

    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, le=1000, description="Items per page")
    total: int = Field(..., ge=0, description="Total number of items")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")
    next_page_token: Optional[str] = Field(None, description="Token for next page")
    prev_page_token: Optional[str] = Field(None, description="Token for previous page")

    @validator("total_pages")
    def calculate_total_pages(cls, v, values):
        """Calculate total pages from total and page_size."""
        total = values.get("total", 0)
        page_size = values.get("page_size", 1)
        return (total + page_size - 1) // page_size if total > 0 else 0


class ListResponseModel(GenericModel, BaseSchema):
    """Generic list response model with pagination."""

    data: list[T] = Field(..., description="List of items")
    pagination: PaginationModel = Field(..., description="Pagination metadata")

    class Config:
        """Model configuration."""

        arbitrary_types_allowed = True


class ErrorResponse(BaseSchema):
    """Error response model."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    code: Optional[str] = Field(None, description="Error code")
    details: Optional[Dict[str, Any]] = Field(None, description="Error details")
    suggestion: Optional[str] = Field(None, description="Suggested resolution")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )


class SuccessResponse(BaseSchema):
    """Success response model."""

    success: bool = Field(True, description="Success flag")
    message: Optional[str] = Field(None, description="Success message")
    data: Optional[Any] = Field(None, description="Response data")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Response timestamp"
    )


class BulkOperation(BaseSchema):
    """Bulk operation model."""

    operation: str = Field(..., description="Operation type")
    items: list[Any] = Field(..., description="Items to process")
    options: Optional[Dict[str, Any]] = Field(None, description="Operation options")
    continue_on_error: bool = Field(False, description="Continue on error")


class BulkOperationResult(BaseSchema):
    """Result of bulk operation."""

    total: int = Field(..., ge=0, description="Total items processed")
    successful: int = Field(..., ge=0, description="Successful operations")
    failed: int = Field(..., ge=0, description="Failed operations")
    results: list[Any] = Field(..., description="Operation results")
    errors: list[Dict[str, Any]] = Field(
        default_factory=list, description="Errors encountered"
    )


class SearchFilter(BaseSchema):
    """Search filter model."""

    field: str = Field(..., description="Field to filter on")
    operator: str = Field(..., description="Comparison operator")
    value: Union[str, int, float, bool, list] = Field(..., description="Filter value")
    case_sensitive: bool = Field(True, description="Case sensitivity")

    @validator("operator")
    def validate_operator(cls, v):
        """Validate operator."""
        valid_operators = {
            "eq",
            "ne",
            "gt",
            "gte",
            "lt",
            "lte",
            "in",
            "nin",
            "contains",
            "starts_with",
            "ends_with",
            "regex",
            "exists",
            "not_exists",
        }
        if v not in valid_operators:
            raise ValueError(f"Invalid operator: {v}")
        return v


class SortOption(BaseSchema):
    """Sort option model."""

    field: str = Field(..., description="Field to sort by")
    direction: str = Field("asc", description="Sort direction")

    @validator("direction")
    def validate_direction(cls, v):
        """Validate sort direction."""
        if v not in ["asc", "desc"]:
            raise ValueError("Direction must be 'asc' or 'desc'")
        return v


class SearchRequest(BaseSchema):
    """Search request model."""

    query: Optional[str] = Field(None, description="Search query")
    filters: list[SearchFilter] = Field(
        default_factory=list, description="Search filters"
    )
    sort: list[SortOption] = Field(default_factory=list, description="Sort options")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=1000, description="Page size")
    include_total: bool = Field(True, description="Include total count")
    fields: Optional[list[str]] = Field(None, description="Fields to return")

    @validator("page_size")
    def validate_page_size(cls, v):
        """Validate page size."""
        if v < 1 or v > 1000:
            raise ValueError("Page size must be between 1 and 1000")
        return v
