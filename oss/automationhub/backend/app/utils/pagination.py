"""
Pagination utilities for API responses

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import Generic, TypeVar, List, Optional, Any
from pydantic import BaseModel
from math import ceil

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response model"""
    items: List[T]
    total: int
    skip: int
    limit: int
    has_next: Optional[bool] = None
    has_previous: Optional[bool] = None
    pages: Optional[int] = None
    current_page: Optional[int] = None

    def __init__(self, **data):
        super().__init__(**data)

        # Calculate derived fields
        self.has_next = self.skip + self.limit < self.total
        self.has_previous = self.skip > 0
        self.pages = ceil(self.total / self.limit) if self.limit > 0 else 0
        self.current_page = (self.skip // self.limit) + 1 if self.limit > 0 else 1


def paginate_query(query, skip: int = 0, limit: int = 100):
    """Apply pagination to a database query"""
    return query.offset(skip).limit(limit)


def create_pagination_links(
    base_url: str,
    total: int,
    skip: int,
    limit: int
) -> dict:
    """Create pagination links for API responses"""
    links = {}
    base_query = f"?skip={skip}&limit={limit}"

    # Self link
    links["self"] = f"{base_url}{base_query}"

    # First page
    if skip > 0:
        links["first"] = f"{base_url}?skip=0&limit={limit}"

    # Previous page
    if skip - limit >= 0:
        links["prev"] = f"{base_url}?skip={max(0, skip - limit)}&limit={limit}"

    # Next page
    if skip + limit < total:
        links["next"] = f"{base_url}?skip={skip + limit}&limit={limit}"

    # Last page
    if total > 0:
        last_skip = ((total - 1) // limit) * limit
        if last_skip != skip:
            links["last"] = f"{base_url}?skip={last_skip}&limit={limit}"

    return links


class PaginationParams:
    """Pagination parameters for API endpoints"""

    def __init__(
        self,
        skip: int = 0,
        limit: int = 100,
        max_limit: int = 1000
    ):
        # Validate and normalize parameters
        self.skip = max(0, int(skip))
        self.limit = max(1, min(int(limit), max_limit))

    @property
    def offset(self) -> int:
        """Get offset for database queries"""
        return self.skip

    def __repr__(self):
        return f"PaginationParams(skip={self.skip}, limit={self.limit})"