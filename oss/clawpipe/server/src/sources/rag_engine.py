"""Retrieval-Augmented Generation engine."""

import logging
from typing import Dict, List

from src.sources.models import Source

logger = logging.getLogger("finsavvyai.sources")


class RAGEngine:
    """Retrieval-Augmented Generation engine."""

    def __init__(self, source_manager, provider):
        self.source_manager = source_manager
        self.provider = provider

    async def query_with_sources(
        self,
        query: str,
        source_ids: List[str],
        max_context: int = 10000
    ) -> Dict:
        """
        Query LLM with RAG context.

        Args:
            query: User query
            source_ids: Source IDs to include
            max_context: Maximum context length

        Returns:
            Response with citations
        """
        # Search for relevant chunks
        relevant_chunks = await self.source_manager.search_chunks(
            query=query,
            source_ids=source_ids,
            top_k=5
        )

        if not relevant_chunks:
            return {
                'response': 'I couldn\'t find relevant information in the provided sources.',
                'citations': [],
                'sources_used': 0
            }

        # Build context from chunks
        context_parts = []
        total_length = 0
        citations = []

        for chunk_data in relevant_chunks:
            if total_length + len(chunk_data['chunk']) > max_context:
                break

            context_parts.append(
                f"[Source: {chunk_data['source_name']}]\n{chunk_data['chunk']}]"
            )
            citations.append({
                'source_id': chunk_data['source_id'],
                'source_name': chunk_data['source_name'],
                'chunk_index': chunk_data['chunk_index'],
            })
            total_length += len(chunk_data['chunk'])

        context = '\n\n'.join(context_parts)

        # Query LLM with context
        from src.providers.base import ChatRequest, ChatMessage

        request = ChatRequest(
            model="lmstudio/model",
            messages=[
                ChatMessage(
                    role="system",
                    content=f"""You are a helpful AI assistant. Answer questions based on the provided sources.

Context from sources:
{context}

When answering:
- Cite sources using [Source: Name] format
- Be specific and accurate
- If the answer is not in the sources, say so"""
                ),
                ChatMessage(
                    role="user",
                    content=query
                )
            ],
            temperature=0.7,
        )

        response = await self.provider.chat(request)

        return {
            'response': response.content,
            'citations': citations,
            'sources_used': len(citations),
            'context_length': total_length
        }
