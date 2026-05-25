"""Combined notebook route registration."""

from aiohttp import web

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


def setup_notebook_routes(app: web.Application) -> None:
    """Register all notebook API routes."""
    # Source management
    app.router.add_post('/api/notebook/sources/upload', handle_upload_source)
    app.router.add_post('/api/notebook/sources/import', handle_upload_source_json)
    app.router.add_get('/api/notebook/sources', handle_list_sources)
    app.router.add_get('/api/notebook/sources/{source_id}', handle_get_source)
    app.router.add_delete('/api/notebook/sources/{source_id}', handle_delete_source)
    app.router.add_post('/api/notebook/sources/{source_id}/chunk', handle_chunk_source)
    app.router.add_post('/api/notebook/sources/{source_id}/summarize', handle_summarize_source)
    app.router.add_post('/api/notebook/query', handle_query_sources)

    # Notebook CRUD
    app.router.add_get('/api/notebook/notebooks', handle_list_notebooks)
    app.router.add_post('/api/notebook/notebooks', handle_create_notebook)
    app.router.add_get('/api/notebook/notebooks/{notebook_id}', handle_get_notebook)
    app.router.add_delete('/api/notebook/notebooks/{notebook_id}', handle_delete_notebook)
    app.router.add_post('/api/notebook/notebooks/{notebook_id}/sections', handle_create_section)

    # Messages and sources
    app.router.add_post('/api/messages', handle_add_message)
    app.router.add_post('/api/attach_sources', handle_attach_sources)
