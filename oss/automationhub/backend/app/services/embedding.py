"""
Embedding service for generating and managing vector embeddings
"""

import asyncio
from typing import List, Dict, Any, Optional, Union
import logging
import uuid
from datetime import datetime
import numpy as np
from sentence_transformers import SentenceTransformer
import hashlib
import json

from app.core.config import settings
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating and managing vector embeddings"""

    def __init__(self):
        self.model = None
        self.cache_service = CacheService()
        self.embedding_cache = {}
        self._initialize_model()

    def _initialize_model(self):
        """Initialize the embedding model"""
        try:
            # Initialize sentence transformer model
            model_name = getattr(settings, 'EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
            self.model = SentenceTransformer(model_name)
            self.embedding_dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Initialized embedding model: {model_name} (dimension: {self.embedding_dimension})")
        except Exception as e:
            logger.error(f"Failed to initialize embedding model: {e}")
            self.embedding_dimension = 384  # Default for MiniLM

    async def generate_embeddings(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        cache_key: Optional[str] = None
    ) -> Union[List[float], List[List[float]]]:
        """Generate embeddings for texts"""
        try:
            if not self.model:
                raise ValueError("Embedding model not initialized")

            # Handle single text input
            is_single = isinstance(texts, str)
            if is_single:
                texts = [texts]

            # Check cache first
            if cache_key:
                cached_result = await self._get_cached_embeddings(cache_key)
                if cached_result:
                    logger.info(f"Retrieved {len(cached_result)} embeddings from cache")
                    return cached_result[0] if is_single else cached_result

            # Generate embeddings in batches
            embeddings = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                batch_embeddings = self.model.encode(
                    batch,
                    convert_to_tensor=False,
                    normalize_embeddings=True
                )
                embeddings.extend(batch_embeddings.tolist())

            # Cache the results
            if cache_key:
                await self._cache_embeddings(cache_key, embeddings)

            logger.info(f"Generated {len(embeddings)} embeddings")
            return embeddings[0] if is_single else embeddings

        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise

    async def generate_document_embeddings(
        self,
        document_id: str,
        title: str,
        content: str,
        metadata: Dict[str, Any],
        chunk_size: int = 500,
        overlap: int = 50
    ) -> List[Dict[str, Any]]:
        """Generate embeddings for document with chunking"""
        try:
            # Split content into chunks
            chunks = self._chunk_text(content, chunk_size, overlap)

            # Generate embeddings for each chunk
            chunk_texts = []
            chunk_metadatas = []

            for i, chunk in enumerate(chunks):
                # Combine title with chunk for better context
                chunk_text = f"Title: {title}\n\nContent: {chunk}"
                chunk_texts.append(chunk_text)

                chunk_metadata = {
                    "document_id": document_id,
                    "chunk_index": i,
                    "chunk_text": chunk,
                    "title": title,
                    **metadata,
                    "created_at": datetime.utcnow().isoformat()
                }
                chunk_metadatas.append(chunk_metadata)

            # Generate embeddings
            embeddings = await self.generate_embeddings(chunk_texts)

            # Create chunk data
            chunk_data = []
            for i, (text, embedding, metadata) in enumerate(zip(chunk_texts, embeddings, chunk_metadatas)):
                chunk_data.append({
                    "id": f"{document_id}_chunk_{i}",
                    "text": text,
                    "embedding": embedding,
                    "metadata": metadata
                })

            logger.info(f"Generated {len(chunk_data)} embeddings for document {document_id}")
            return chunk_data

        except Exception as e:
            logger.error(f"Failed to generate document embeddings: {e}")
            raise

    def _chunk_text(self, text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split text into overlapping chunks"""
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at word boundary
            if end < len(text):
                last_space = text.rfind(' ', start, end)
                if last_space > start:
                    end = last_space

            chunks.append(text[start:end].strip())
            start = end - overlap if overlap > 0 else end

        return [chunk for chunk in chunks if chunk]

    async def calculate_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between two embeddings"""
        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)

            # Calculate cosine similarity
            similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
            return float(similarity)

        except Exception as e:
            logger.error(f"Failed to calculate similarity: {e}")
            return 0.0

    async def find_similar_documents(
        self,
        query_embedding: List[float],
        document_embeddings: List[Dict[str, Any]],
        threshold: float = 0.7,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Find similar documents based on embedding similarity"""
        try:
            similarities = []

            for doc_data in document_embeddings:
                doc_embedding = doc_data.get("embedding", [])
                if doc_embedding:
                    similarity = await self.calculate_similarity(query_embedding, doc_embedding)
                    if similarity >= threshold:
                        similarities.append({
                            "document_id": doc_data.get("document_id"),
                            "chunk_id": doc_data.get("id"),
                            "similarity": similarity,
                            "metadata": doc_data.get("metadata", {}),
                            "text": doc_data.get("text", "")
                        })

            # Sort by similarity and return top_k
            similarities.sort(key=lambda x: x["similarity"], reverse=True)
            return similarities[:top_k]

        except Exception as e:
            logger.error(f"Failed to find similar documents: {e}")
            return []

    async def _get_cached_embeddings(self, cache_key: str) -> Optional[List[List[float]]]:
        """Get embeddings from cache"""
        try:
            cached_data = await self.cache_service.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
            return None
        except Exception as e:
            logger.warning(f"Failed to get cached embeddings: {e}")
            return None

    async def _cache_embeddings(self, cache_key: str, embeddings: List[List[float]]):
        """Cache embeddings"""
        try:
            await self.cache_service.set(
                cache_key,
                json.dumps(embeddings),
                expire=3600  # 1 hour
            )
        except Exception as e:
            logger.warning(f"Failed to cache embeddings: {e}")

    def _generate_cache_key(self, text: str) -> str:
        """Generate cache key for text"""
        hash_obj = hashlib.md5(text.encode())
        return f"embedding:{hash_obj.hexdigest()}"

    async def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings"""
        return getattr(self, 'embedding_dimension', 384)

    async def health_check(self) -> bool:
        """Check if embedding service is healthy"""
        try:
            if not self.model:
                return False

            # Try to generate a test embedding
            test_embedding = await self.generate_embeddings("test")
            return len(test_embedding) > 0

        except Exception as e:
            logger.error(f"Embedding service health check failed: {e}")
            return False


# Global embedding service instance
_embedding_service = None

async def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service instance"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service