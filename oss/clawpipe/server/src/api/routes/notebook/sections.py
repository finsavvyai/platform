"""Section and message handlers for notebooks."""

import logging
from aiohttp import web

from src.notebooks.manager import get_notebook_manager

logger = logging.getLogger("finsavvyai.notebook.api")


async def handle_create_section(request: web.Request) -> web.Response:
    """Create a new section in a notebook."""
    notebook_id = request.match_info.get('notebook_id')

    if not notebook_id:
        return web.json_response(
            {"error": "notebook_id required"},
            status=400
        )

    try:
        data = await request.json()
        title = data.get('title', 'New Section')

        manager = get_notebook_manager()
        section = manager.create_section(notebook_id, title)

        if not section:
            return web.json_response(
                {"error": "Notebook not found"},
                status=404
            )

        return web.json_response({
            "id": section.id,
            "title": section.title,
            "messages": len(section.messages),
            "sources": len(section.sources),
            "created_at": section.created_at
        })

    except Exception as e:
        logger.error(f"Failed to create section: {e}")
        return web.json_response(
            {"error": f"Failed to create section: {str(e)}"},
            status=500
        )


async def handle_add_message(request: web.Request) -> web.Response:
    """Add a message to a section."""
    try:
        data = await request.json()
        notebook_id = data.get('notebook_id')
        section_id = data.get('section_id')
        role = data.get('role', 'user')
        content = data.get('content', '')
        citations = data.get('citations', [])

        if not all([notebook_id, section_id, content]):
            return web.json_response(
                {"error": "notebook_id, section_id, and content are required"},
                status=400
            )

        manager = get_notebook_manager()
        message = manager.add_message(
            notebook_id=notebook_id,
            section_id=section_id,
            role=role,
            content=content,
            citations=citations
        )

        if not message:
            return web.json_response(
                {"error": "Notebook or section not found"},
                status=404
            )

        return web.json_response({
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "citations": message.citations,
            "timestamp": message.timestamp
        })

    except Exception as e:
        logger.error(f"Failed to add message: {e}")
        return web.json_response(
            {"error": f"Failed to add message: {str(e)}"},
            status=500
        )


async def handle_attach_sources(request: web.Request) -> web.Response:
    """Attach sources to a section."""
    try:
        data = await request.json()
        notebook_id = data.get('notebook_id')
        section_id = data.get('section_id')
        source_ids = data.get('source_ids', [])

        if not all([notebook_id, section_id, source_ids]):
            return web.json_response(
                {"error": "notebook_id, section_id, and source_ids are required"},
                status=400
            )

        manager = get_notebook_manager()
        success = manager.attach_sources(
            notebook_id=notebook_id,
            section_id=section_id,
            source_ids=source_ids
        )

        if success:
            return web.json_response({
                "status": "attached",
                "source_count": len(source_ids)
            })
        else:
            return web.json_response(
                {"error": "Notebook or section not found"},
                status=404
            )

    except Exception as e:
        logger.error(f"Failed to attach sources: {e}")
        return web.json_response(
            {"error": f"Failed to attach sources: {str(e)}"},
            status=500
        )
