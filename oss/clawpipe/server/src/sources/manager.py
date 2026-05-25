"""Source management for NotebookLM-like features.

Handles document upload, chunking, and RAG queries.
"""

import logging
import hashlib
from pathlib import Path
from typing import Dict, List, Optional

from src.sources.models import Source
from src.sources.rag_engine import RAGEngine

logger = logging.getLogger("finsavvyai.sources")


class SourceManager:
    """Manage document sources for RAG queries."""

    def __init__(self):
        self.sources: Dict[str, Source] = {}
        self.chunk_size = 1000
        self.chunk_overlap = 200

    async def upload_source(
        self,
        file_path: str,
        file_type: str,
        content: str
    ) -> Source:
        """Upload and process a document source."""
        source_id = f"source_{hashlib.md5(content.encode()).hexdigest()[:12]}"

        source = Source(
            id=source_id,
            name=Path(file_path).name,
            file_type=file_type,
            content=content,
            metadata={
                "size": len(content),
                "file_path": file_path,
            }
        )

        source.chunks = await self._chunk_content(content)
        self.sources[source_id] = source

        logger.info(
            f"Uploaded source: {source.name} ({len(source.chunks)} chunks)"
        )
        return source

    async def _chunk_content(self, content: str) -> List[str]:
        """Split content into overlapping chunks."""
        chunks = []
        start = 0
        content_length = len(content)

        while start < content_length:
            end = start + self.chunk_size
            chunk = content[start:end]
            chunks.append(chunk)
            start = end - self.chunk_overlap

        return chunks

    def get_source(self, source_id: str) -> Optional[Source]:
        """Get a source by ID."""
        return self.sources.get(source_id)

    def list_sources(self) -> List[Source]:
        """List all sources."""
        return list(self.sources.values())

    async def search_chunks(
        self,
        query: str,
        source_ids: Optional[List[str]] = None,
        top_k: int = 5
    ) -> List[Dict]:
        """
        Search for relevant chunks across sources.

        Args:
            query: Search query
            source_ids: Source IDs to search (all if None)
            top_k: Number of top chunks to return

        Returns:
            List of relevant chunks with scores
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        relevant_chunks = []

        for source in self.list_sources():
            if source_ids and source.id not in source_ids:
                continue

            for i, chunk in enumerate(source.chunks):
                chunk_lower = chunk.lower()
                score = sum(
                    1 for word in query_words if word in chunk_lower
                )

                if score > 0:
                    relevant_chunks.append({
                        'source_id': source.id,
                        'source_name': source.name,
                        'chunk_index': i,
                        'chunk': chunk,
                        'score': score,
                    })

        relevant_chunks.sort(key=lambda x: x['score'], reverse=True)
        return relevant_chunks[:top_k]

    async def delete_source(self, source_id: str) -> bool:
        """Delete a source."""
        if source_id in self.sources:
            del self.sources[source_id]
            logger.info(f"Deleted source: {source_id}")
            return True
        return False


# Global instances
source_manager = SourceManager()


def get_source_manager() -> SourceManager:
    """Get the global source manager instance."""
    return source_manager


def get_rag_engine(provider) -> RAGEngine:
    """Get a RAG engine instance."""
    return RAGEngine(source_manager, provider)
