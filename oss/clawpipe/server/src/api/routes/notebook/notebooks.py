"""Notebook CRUD handlers."""

import logging
from aiohttp import web

from src.notebooks.manager import get_notebook_manager

logger = logging.getLogger("finsavvyai.notebook.api")


async def handle_list_notebooks(request: web.Request) -> web.Response:
    """List all notebooks."""
    manager = get_notebook_manager()
    notebooks = manager.list_notebooks()

    return web.json_response({
        "notebooks": [
            {
                "id": nb.id,
                "name": nb.name,
                "sections": len(nb.sections),
                "created_at": nb.created_at,
                "updated_at": nb.updated_at
            }
            for nb in notebooks
        ]
    })


async def handle_create_notebook(request: web.Request) -> web.Response:
    """Create a new notebook."""
    try:
        data = await request.json()
        name = data.get('name', 'New Notebook')

        manager = get_notebook_manager()
        notebook = manager.create_notebook(name)

        return web.json_response({
            "id": notebook.id,
            "name": notebook.name,
            "sections": len(notebook.sections),
            "created_at": notebook.created_at
        })

    except Exception as e:
        logger.error(f"Failed to create notebook: {e}")
        return web.json_response(
            {"error": f"Failed to create notebook: {str(e)}"},
            status=500
        )


async def handle_get_notebook(request: web.Request) -> web.Response:
    """Get a specific notebook."""
    notebook_id = request.match_info.get('notebook_id')

    if not notebook_id:
        return web.json_response(
            {"error": "notebook_id required"},
            status=400
        )

    manager = get_notebook_manager()
    notebook = manager.get_notebook(notebook_id)

    if not notebook:
        return web.json_response(
            {"error": "Notebook not found"},
            status=404
        )

    return web.json_response({
        "id": notebook.id,
        "name": notebook.name,
        "sections": [
            {
                "id": s.id,
                "title": s.title,
                "messages": s.messages,
                "sources": s.sources,
                "created_at": s.created_at
            }
            for s in notebook.sections
        ],
        "created_at": notebook.created_at,
        "updated_at": notebook.updated_at
    })


async def handle_delete_notebook(request: web.Request) -> web.Response:
    """Delete a notebook."""
    notebook_id = request.match_info.get('notebook_id')

    if not notebook_id:
        return web.json_response(
            {"error": "notebook_id required"},
            status=400
        )

    manager = get_notebook_manager()
    success = manager.delete_notebook(notebook_id)

    if success:
        return web.json_response({
            "status": "deleted",
            "notebook_id": notebook_id
        })
    else:
        return web.json_response(
            {"error": "Notebook not found"},
            status=404
        )
