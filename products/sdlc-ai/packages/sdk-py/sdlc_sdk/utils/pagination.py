"""
Pagination utilities for SDLC.ai SDK

Provides helpers for handling paginated API responses.
"""

from typing import Any, Dict, Iterator, List, Optional, Callable, Union
import structlog

logger = structlog.get_logger("sdlc_sdk.pagination")


class PaginatedResponse:
    """
    Represents a paginated response from the API.
    """

    def __init__(
        self,
        data: List[Any],
        total: int,
        page: int,
        page_size: int,
        has_next: bool,
        has_prev: bool,
        next_page_token: Optional[str] = None,
        prev_page_token: Optional[str] = None,
        response_data: Optional[Dict[str, Any]] = None,
    ):
        self.data = data
        self.total = total
        self.page = page
        self.page_size = page_size
        self.has_next = has_next
        self.has_prev = has_prev
        self.next_page_token = next_page_token
        self.prev_page_token = prev_page_token
        self.response_data = response_data or {}

    def __len__(self) -> int:
        """Get the number of items in current page."""
        return len(self.data)

    def __iter__(self):
        """Iterate over items in current page."""
        return iter(self.data)

    def __getitem__(self, index: Union[int, slice]) -> Any:
        """Get item by index or slice."""
        return self.data[index]


class Paginator:
    """
    Paginator for iterating through all pages of a paginated response.
    """

    def __init__(
        self,
        fetch_page: Callable,
        page_size: int = 100,
        max_pages: Optional[int] = None,
        max_items: Optional[int] = None,
    ):
        """
        Initialize paginator.

        Args:
            fetch_page: Function to fetch a page (should accept page_token and page_size)
            page_size: Number of items per page
            max_pages: Maximum number of pages to fetch
            max_items: Maximum number of items to fetch
        """
        self.fetch_page = fetch_page
        self.page_size = page_size
        self.max_pages = max_pages
        self.max_items = max_items
        self._current_page = 0
        self._total_items = 0

    def __iter__(self) -> Iterator[Any]:
        """Iterate over all items across all pages."""
        next_page_token = None

        while True:
            # Check limits
            if self.max_pages and self._current_page >= self.max_pages:
                break
            if self.max_items and self._total_items >= self.max_items:
                break

            # Fetch page
            try:
                response = self.fetch_page(
                    page_token=next_page_token, page_size=self.page_size
                )
            except Exception as e:
                logger.error(
                    "Failed to fetch page", page=self._current_page, error=str(e)
                )
                break

            # Iterate through items in page
            for item in response.data:
                if self.max_items and self._total_items >= self.max_items:
                    return
                yield item
                self._total_items += 1

            # Check if there are more pages
            if not response.has_next or not response.next_page_token:
                break

            next_page_token = response.next_page_token
            self._current_page += 1

    def pages(self) -> Iterator[PaginatedResponse]:
        """Iterate over pages instead of individual items."""
        next_page_token = None
        page_count = 0

        while True:
            # Check page limit
            if self.max_pages and page_count >= self.max_pages:
                break

            # Fetch page
            try:
                response = self.fetch_page(
                    page_token=next_page_token, page_size=self.page_size
                )
            except Exception as e:
                logger.error("Failed to fetch page", page=page_count, error=str(e))
                break

            yield response
            page_count += 1

            # Check if there are more pages
            if not response.has_next or not response.next_page_token:
                break

            next_page_token = response.next_page_token

    def collect_all(self) -> List[Any]:
        """
        Collect all items into a single list.

        Returns:
            List of all items
        """
        return list(self)


def paginate(
    fetch_page: Callable,
    page_size: int = 100,
    max_pages: Optional[int] = None,
    max_items: Optional[int] = None,
) -> Paginator:
    """
    Create a paginator for API responses.

    Args:
        fetch_page: Function to fetch a page
        page_size: Number of items per page
        max_pages: Maximum number of pages to fetch
        max_items: Maximum number of items to fetch

    Returns:
        Paginator instance
    """
    return Paginator(
        fetch_page=fetch_page,
        page_size=page_size,
        max_pages=max_pages,
        max_items=max_items,
    )


def handle_pagination(
    response_data: Dict[str, Any], data_key: str = "data"
) -> PaginatedResponse:
    """
    Convert raw API response to PaginatedResponse.

    Args:
        response_data: Raw API response
        data_key: Key containing the data array

    Returns:
        PaginatedResponse instance
    """
    # Extract pagination info
    pagination = response_data.get("pagination", {})

    # Extract data
    data = response_data.get(data_key, [])

    # Create response
    return PaginatedResponse(
        data=data,
        total=pagination.get("total", len(data)),
        page=pagination.get("page", 1),
        page_size=pagination.get("page_size", len(data)),
        has_next=pagination.get("has_next", False),
        has_prev=pagination.get("has_prev", False),
        next_page_token=pagination.get("next_page_token"),
        prev_page_token=pagination.get("prev_page_token"),
        response_data=response_data,
    )


async def async_paginate(
    fetch_page: Callable,
    page_size: int = 100,
    max_pages: Optional[int] = None,
    max_items: Optional[int] = None,
) -> Iterator[Any]:
    """
    Async version of paginate.

    Args:
        fetch_page: Async function to fetch a page
        page_size: Number of items per page
        max_pages: Maximum number of pages to fetch
        max_items: Maximum number of items to fetch

    Yields:
        Items from all pages
    """
    next_page_token = None
    current_page = 0
    total_items = 0

    while True:
        # Check limits
        if max_pages and current_page >= max_pages:
            break
        if max_items and total_items >= max_items:
            break

        # Fetch page
        response = await fetch_page(page_token=next_page_token, page_size=page_size)

        # Iterate through items
        for item in response.data:
            if max_items and total_items >= max_items:
                return
            yield item
            total_items += 1

        # Check if there are more pages
        if not response.has_next or not response.next_page_token:
            break

        next_page_token = response.next_page_token
        current_page += 1
