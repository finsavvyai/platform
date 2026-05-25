"""Notebook routes package."""

from .routes import setup_notebook_routes
from .sources import (
    handle_upload_source,
    handle_upload_source_json,
    handle_list_sources,
    handle_get_source,
    handle_delete_source,
)
from .query import (
    handle_query_sources,
    handle_chunk_source,
    handle_summarize_source,
)
from .notebooks import (
    handle_list_notebooks,
    handle_create_notebook,
    handle_get_notebook,
    handle_delete_notebook,
)
from .sections import (
    handle_create_section,
    handle_add_message,
    handle_attach_sources,
)

__all__ = [
    "setup_notebook_routes",
    "handle_upload_source",
    "handle_upload_source_json",
    "handle_list_sources",
    "handle_get_source",
    "handle_delete_source",
    "handle_query_sources",
    "handle_chunk_source",
    "handle_summarize_source",
    "handle_list_notebooks",
    "handle_create_notebook",
    "handle_get_notebook",
    "handle_delete_notebook",
    "handle_create_section",
    "handle_add_message",
    "handle_attach_sources",
]
