"""Source upload and management handlers."""

import logging
from aiohttp import web

from src.sources.manager import get_source_manager

logger = logging.getLogger("finsavvyai.notebook")


async def handle_upload_source(request: web.Request) -> web.Response:
    """Upload a document source for RAG."""
    source_manager = get_source_manager()

    try:
        # Read raw multipart data
        content_type = request.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            return web.json_response(
                {"error": "Content-Type must be multipart/form-data"},
                status=400
            )

        # Parse multipart form data
        reader = await request.multipart()

        field = await reader.next()
        if not field:
            return web.json_response(
                {"error": "No file provided"},
                status=400
            )

        content = await field.read()
        filename = field.filename or "unknown"

        # Determine file type
        if filename.endswith('.pdf'):
            file_type = 'pdf'
            # Extract text from PDF
            import fitz
            doc = fitz.open(stream=content, filetype='pdf')
            text_content = ''
            for page in doc:
                text_content += page.get_text()
        elif filename.endswith(('.txt', '.md', '.py', '.js', '.ts')):
            file_type = 'text'
            text_content = content.decode('utf-8')
        else:
            file_type = 'unknown'
            text_content = content.decode('utf-8', errors='ignore')

        # Upload source
        source = await source_manager.upload_source(
            file_path=filename,
            file_type=file_type,
            content=text_content
        )

        return web.json_response({
            "source_id": source.id,
            "name": source.name,
            "type": source.file_type,
            "chunks": len(source.chunks),
            "size": source.metadata.get("size", 0)
        })

    except Exception as e:
        logger.error(f"Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response(
            {"error": f"Upload failed: {str(e)}"},
            status=500
        )


async def handle_upload_source_json(request: web.Request) -> web.Response:
    """Upload a document source via JSON (alternative to multipart)."""
    source_manager = get_source_manager()

    try:
        data = await request.json()

        filename = data.get('filename', 'document.txt')
        file_type = data.get('file_type', 'text')
        content = data.get('content', '')

        # Handle base64 encoding
        if data.get('encoding') == 'base64':
            import base64
            content = base64.b64decode(content).decode('utf-8')

        # Upload source
        source = await source_manager.upload_source(
            file_path=filename,
            file_type=file_type,
            content=content
        )

        return web.json_response({
            "source_id": source.id,
            "name": source.name,
            "type": source.file_type,
            "chunks": len(source.chunks),
            "size": source.metadata.get("size", 0)
        })

    except Exception as e:
        logger.error(f"JSON upload failed: {e}")
        import traceback
        traceback.print_exc()
        return web.json_response(
            {"error": f"JSON upload failed: {str(e)}"},
            status=500
        )


async def handle_list_sources(request: web.Request) -> web.Response:
    """List all uploaded sources."""
    source_manager = get_source_manager()
    sources = source_manager.list_sources()

    return web.json_response({
        "sources": [
            {
                "id": s.id,
                "name": s.name,
                "type": s.file_type,
                "chunks": len(s.chunks),
                "size": s.metadata.get("size", 0),
                "created_at": s.created_at
            }
            for s in sources
        ]
    })


async def handle_get_source(request: web.Request) -> web.Response:
    """Get details of a specific source."""
    source_id = request.match_info.get('source_id')

    if not source_id:
        return web.json_response(
            {"error": "source_id required"},
            status=400
        )

    source_manager = get_source_manager()
    source = source_manager.get_source(source_id)

    if not source:
        return web.json_response(
            {"error": "Source not found"},
            status=404
        )

    return web.json_response({
        "id": source.id,
        "name": source.name,
        "type": source.file_type,
        "content": source.content[:500] + "..." if len(source.content) > 500 else source.content,
        "chunks": len(source.chunks),
        "metadata": source.metadata,
        "created_at": source.created_at
    })


async def handle_delete_source(request: web.Request) -> web.Response:
    """Delete a source."""
    source_id = request.match_info.get('source_id')

    if not source_id:
        return web.json_response(
            {"error": "source_id required"},
            status=400
        )

    source_manager = get_source_manager()
    success = await source_manager.delete_source(source_id)

    if success:
        return web.json_response({
            "status": "deleted",
            "source_id": source_id
        })
    else:
        return web.json_response(
            {"error": "Source not found"},
            status=404
        )
