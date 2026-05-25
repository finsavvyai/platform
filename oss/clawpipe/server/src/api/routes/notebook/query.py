"""Source query, chunking, and summarization handlers."""

import logging
from aiohttp import web

from src.sources.manager import get_source_manager, get_rag_engine

logger = logging.getLogger("finsavvyai.notebook")


async def handle_query_sources(request: web.Request) -> web.Response:
    """Query across uploaded sources with RAG."""
    try:
        data = await request.json()
        query = data.get('query')
        source_ids = data.get('source_ids', [])

        if not query:
            return web.json_response(
                {"error": "query required"},
                status=400
            )

        if not source_ids:
            return web.json_response(
                {"error": "source_ids required"},
                status=400
            )

        # Get provider and RAG engine
        from src.core.provider_registry import get_provider_registry
        registry = get_provider_registry()
        provider = registry.get_provider("lmstudio")

        if not provider:
            return web.json_response(
                {"error": "LM Studio provider not available"},
                status=503
            )

        rag_engine = get_rag_engine(provider)

        # Query with RAG
        result = await rag_engine.query_with_sources(
            query=query,
            source_ids=source_ids
        )

        return web.json_response(result)

    except Exception as e:
        logger.error(f"Query failed: {e}")
        return web.json_response(
            {"error": f"Query failed: {str(e)}"},
            status=500
        )


async def handle_chunk_source(request: web.Request) -> web.Response:
    """Chunk a source into overlapping pieces."""
    source_id = request.match_info.get('source_id')

    if not source_id:
        return web.json_response(
            {"error": "source_id required"},
            status=400
        )

    try:
        data = await request.json()
        chunk_size = data.get('chunk_size', 1000)
        overlap = data.get('overlap', 200)

        source_manager = get_source_manager()
        source = source_manager.get_source(source_id)

        if not source:
            return web.json_response(
                {"error": "Source not found"},
                status=404
            )

        # Re-chunk with new parameters
        source.chunk_size = chunk_size
        source.chunk_overlap = overlap
        source.chunks = await source_manager._chunk_content(source.content)

        return web.json_response({
            "source_id": source_id,
            "chunks": len(source.chunks),
            "chunk_size": chunk_size,
            "overlap": overlap
        })

    except Exception as e:
        logger.error(f"Chunking failed: {e}")
        return web.json_response(
            {"error": f"Chunking failed: {str(e)}"},
            status=500
        )


async def handle_summarize_source(request: web.Request) -> web.Response:
    """Summarize a source document."""
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

    try:
        # Get provider
        from src.core.provider_registry import get_provider_registry
        registry = get_provider_registry()
        provider = registry.get_provider("lmstudio")

        if not provider:
            return web.json_response(
                {"error": "LM Studio provider not available"},
                status=503
            )

        # Generate summary
        from src.providers.base import ChatRequest, ChatMessage

        request = ChatRequest(
            model="lmstudio/model",
            messages=[
                ChatMessage(
                    role="system",
                    content="You are a helpful assistant. Summarize the given document concisely."
                ),
                ChatMessage(
                    role="user",
                    content=f"Summarize this document:\n\n{source.content[:4000]}"
                )
            ],
            temperature=0.5,
        )

        response = await provider.chat(request)

        return web.json_response({
            "source_id": source_id,
            "summary": response.content,
            "original_length": len(source.content),
            "summary_length": len(response.content)
        })

    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        return web.json_response(
            {"error": f"Summarization failed: {str(e)}"},
            status=500
        )
