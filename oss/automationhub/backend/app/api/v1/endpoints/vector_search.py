"""
Vector Search API endpoints for semantic search and vector database operations.

Provides comprehensive vector database functionality including semantic search,
hybrid search, document similarity, and real-time indexing.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field

from app.services.vector_store import VectorStoreService
from app.services.embedding import get_embedding_service
from app.core.auth import get_current_user
from app.schemas.auth import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize vector store service
vector_store = VectorStoreService()


class VectorSearchRequest(BaseModel):
    """Request model for vector search."""
    query: str = Field(..., min_length=1, description="Search query")
    n_results: int = Field(default=10, ge=1, le=100, description="Number of results to return")
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity score")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    include_scores: bool = Field(default=True, description="Include similarity scores in results")
    search_method: str = Field(default="semantic", regex="^(semantic|hybrid|text)$", description="Search method")


class VectorSearchResponse(BaseModel):
    """Response model for vector search."""
    query: str
    results: List[Dict[str, Any]]
    total_found: int
    search_method: str
    search_time_ms: Optional[float] = None
    filters_applied: Dict[str, Any] = Field(default_factory=dict)


class DocumentIndexRequest(BaseModel):
    """Request model for document indexing."""
    document_id: str = Field(..., description="Unique document identifier")
    title: str = Field(..., description="Document title")
    content: str = Field(..., min_length=1, description="Document content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    chunk_size: int = Field(default=500, ge=100, le=2000, description="Chunk size for processing")
    overlap: int = Field(default=50, ge=0, le=200, description="Overlap between chunks")


class DocumentIndexResponse(BaseModel):
    """Response model for document indexing."""
    success: bool
    document_id: str
    chunks_added: int
    chunk_ids: List[str]
    processing_time_ms: Optional[float] = None
    error: Optional[str] = None


class SimilarDocumentRequest(BaseModel):
    """Request model for finding similar documents."""
    document_id: str = Field(..., description="Reference document ID")
    n_results: int = Field(default=10, ge=1, le=50, description="Number of similar documents")
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")


class HybridSearchRequest(BaseModel):
    """Request model for hybrid search."""
    query: str = Field(..., min_length=1, description="Search query")
    text_weight: float = Field(default=0.3, ge=0.0, le=1.0, description="Weight for text search")
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0, description="Weight for vector search")
    n_results: int = Field(default=10, ge=1, le=100, description="Number of results to return")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="Minimum similarity threshold")


class BatchIndexRequest(BaseModel):
    """Request model for batch document indexing."""
    documents: List[DocumentIndexRequest] = Field(..., min_items=1, max_items=100, description="Documents to index")


@router.post("/search", response_model=VectorSearchResponse)
async def search_vectors(
    request: VectorSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Perform vector search with specified method."""
    try:
        start_time = datetime.now()

        # Add user filter to ensure users only search their own documents
        user_filters = request.filters.copy()
        user_filters["user_id"] = str(current_user.id)

        # Perform search based on method
        if request.search_method == "semantic":
            results = await vector_store.semantic_search(
                query=request.query,
                n_results=request.n_results,
                filters=user_filters,
                similarity_threshold=request.similarity_threshold,
                include_scores=request.include_scores
            )
        elif request.search_method == "hybrid":
            results = await vector_store.hybrid_search(
                query=request.query,
                text_weight=0.3,  # Default weights
                vector_weight=0.7,
                n_results=request.n_results,
                filters=user_filters
            )
        else:  # text search
            results = await vector_store.search_documents(
                query=request.query,
                n_results=request.n_results,
                where=user_filters
            )

        # Calculate search time
        search_time = (datetime.now() - start_time).total_seconds() * 1000

        # Log search for analytics
        background_tasks.add_task(
            log_search_analytics,
            user_id=current_user.id,
            query=request.query,
            method=request.search_method,
            results_count=len(results.get("results", [])),
            search_time_ms=search_time
        )

        return VectorSearchResponse(
            query=request.query,
            results=results.get("results", []),
            total_found=results.get("total_found", 0),
            search_method=request.search_method,
            search_time_ms=search_time,
            filters_applied=user_filters
        )

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/index", response_model=DocumentIndexResponse)
async def index_document(
    request: DocumentIndexRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Index a document for vector search."""
    try:
        start_time = datetime.now()

        # Add user metadata
        enhanced_metadata = request.metadata.copy()
        enhanced_metadata.update({
            "user_id": str(current_user.id),
            "indexed_at": datetime.utcnow().isoformat(),
            "indexed_by": str(current_user.id)
        })

        # Index document
        result = await vector_store.add_document_with_embeddings(
            document_id=request.document_id,
            title=request.title,
            content=request.content,
            metadata=enhanced_metadata,
            chunk_size=request.chunk_size,
            overlap=request.overlap
        )

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        if result.get("success"):
            # Schedule background processing for enhanced features
            background_tasks.add_task(
                process_indexed_document,
                document_id=request.document_id,
                user_id=current_user.id
            )

            return DocumentIndexResponse(
                success=True,
                document_id=request.document_id,
                chunks_added=result.get("chunks_added", 0),
                chunk_ids=result.get("chunk_ids", []),
                processing_time_ms=processing_time
            )
        else:
            return DocumentIndexResponse(
                success=False,
                document_id=request.document_id,
                chunks_added=0,
                chunk_ids=[],
                processing_time_ms=processing_time,
                error=result.get("error", "Unknown error")
            )

    except Exception as e:
        logger.error(f"Document indexing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")


@router.post("/index/batch")
async def batch_index_documents(
    request: BatchIndexRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Index multiple documents in batch."""
    try:
        results = []
        success_count = 0

        for doc_request in request.documents:
            try:
                # Add user metadata
                enhanced_metadata = doc_request.metadata.copy()
                enhanced_metadata.update({
                    "user_id": str(current_user.id),
                    "indexed_at": datetime.utcnow().isoformat(),
                    "indexed_by": str(current_user.id),
                    "batch_indexed": True
                })

                result = await vector_store.add_document_with_embeddings(
                    document_id=doc_request.document_id,
                    title=doc_request.title,
                    content=doc_request.content,
                    metadata=enhanced_metadata,
                    chunk_size=doc_request.chunk_size,
                    overlap=doc_request.overlap
                )

                results.append(DocumentIndexResponse(
                    success=result.get("success", False),
                    document_id=doc_request.document_id,
                    chunks_added=result.get("chunks_added", 0),
                    chunk_ids=result.get("chunk_ids", []),
                    error=result.get("error") if not result.get("success") else None
                ))

                if result.get("success"):
                    success_count += 1
                    # Schedule background processing
                    background_tasks.add_task(
                        process_indexed_document,
                        document_id=doc_request.document_id,
                        user_id=current_user.id
                    )

            except Exception as e:
                logger.error(f"Failed to index document {doc_request.document_id}: {e}")
                results.append(DocumentIndexResponse(
                    success=False,
                    document_id=doc_request.document_id,
                    chunks_added=0,
                    chunk_ids=[],
                    error=str(e)
                ))

        return {
            "batch_id": str(UUID.uuid4()),
            "total_documents": len(request.documents),
            "successful": success_count,
            "failed": len(request.documents) - success_count,
            "results": results
        }

    except Exception as e:
        logger.error(f"Batch indexing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch indexing failed: {str(e)}")


@router.post("/hybrid-search", response_model=VectorSearchResponse)
async def hybrid_search(
    request: HybridSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Perform hybrid search combining text and vector search."""
    try:
        start_time = datetime.now()

        # Add user filter
        user_filters = request.filters.copy()
        user_filters["user_id"] = str(current_user.id)

        # Perform hybrid search
        results = await vector_store.hybrid_search(
            query=request.query,
            text_weight=request.text_weight,
            vector_weight=request.vector_weight,
            n_results=request.n_results,
            filters=user_filters
        )

        # Filter by similarity threshold if specified
        if request.similarity_threshold > 0:
            filtered_results = []
            for result in results.get("results", []):
                similarity = result.get("combined_score", result.get("similarity_score", 0))
                if similarity >= request.similarity_threshold:
                    filtered_results.append(result)
            results["results"] = filtered_results
            results["total_found"] = len(filtered_results)

        search_time = (datetime.now() - start_time).total_seconds() * 1000

        # Log search analytics
        background_tasks.add_task(
            log_search_analytics,
            user_id=current_user.id,
            query=request.query,
            method="hybrid",
            results_count=len(results.get("results", [])),
            search_time_ms=search_time,
            weights={"text": request.text_weight, "vector": request.vector_weight}
        )

        return VectorSearchResponse(
            query=request.query,
            results=results.get("results", []),
            total_found=results.get("total_found", 0),
            search_method="hybrid",
            search_time_ms=search_time,
            filters_applied=user_filters
        )

    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Hybrid search failed: {str(e)}")


@router.post("/similar/{document_id}")
async def find_similar_documents(
    document_id: str,
    request: SimilarDocumentRequest,
    current_user: User = Depends(get_current_user)
):
    """Find documents similar to the specified document."""
    try:
        # Check if user has access to the reference document
        user_filters = {"user_id": str(current_user.id)}

        results = await vector_store.find_similar_documents(
            document_id=document_id,
            n_results=request.n_results,
            similarity_threshold=request.similarity_threshold
        )

        # Filter results to only include user's documents
        if "similar_documents" in results:
            user_similar_docs = []
            for doc in results["similar_documents"]:
                doc_metadata = doc.get("metadata", {})
                if doc_metadata.get("user_id") == str(current_user.id):
                    user_similar_docs.append(doc)
            results["similar_documents"] = user_similar_docs
            results["total_found"] = len(user_similar_docs)

        return results

    except Exception as e:
        logger.error(f"Similar document search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Similar document search failed: {str(e)}")


@router.delete("/documents/{document_id}")
async def remove_document_from_index(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a document from the vector index."""
    try:
        # Get chunks for the document (filtered by user)
        search_results = await vector_store.search_documents(
            query=f"document_id:{document_id}",
            where={"user_id": str(current_user.id)},
            n_results=1000
        )

        if search_results.get("ids"):
            # Delete all chunks for this document
            success = await vector_store.delete_documents(search_results["ids"])

            if success:
                return {
                    "status": "deleted",
                    "document_id": document_id,
                    "chunks_deleted": len(search_results["ids"])
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to delete document from index")
        else:
            raise HTTPException(status_code=404, detail="Document not found in index")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document removal from index failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document removal failed: {str(e)}")


@router.put("/documents/{document_id}")
async def update_document_index(
    document_id: str,
    request: DocumentIndexRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Update a document in the vector index."""
    try:
        # Add user metadata
        enhanced_metadata = request.metadata.copy()
        enhanced_metadata.update({
            "user_id": str(current_user.id),
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": str(current_user.id)
        })

        # Update document embeddings
        result = await vector_store.update_document_embeddings(
            document_id=document_id,
            title=request.title,
            content=request.content,
            metadata=enhanced_metadata
        )

        if result.get("success"):
            # Schedule background processing for updates
            background_tasks.add_task(
                process_indexed_document,
                document_id=document_id,
                user_id=current_user.id
            )

            return {
                "status": "updated",
                "document_id": document_id,
                "action": result.get("action"),
                "chunks_processed": result.get("chunks_added", 0)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Update failed"))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document index update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Document update failed: {str(e)}")


@router.get("/statistics")
async def get_vector_statistics(
    current_user: User = Depends(get_current_user)
):
    """Get vector database statistics for the current user."""
    try:
        # Get general statistics
        general_stats = await vector_store.get_document_statistics()

        # Get user-specific statistics
        user_docs = await vector_store.search_documents(
            query="*",
            where={"user_id": str(current_user.id)},
            n_results=10000
        )

        user_stats = {
            "user_id": str(current_user.id),
            "total_chunks": len(user_docs.get("ids", [])),
            "unique_documents": len(set(
                meta.get("document_id") for meta in user_docs.get("metadatas", [])
                if meta.get("document_id")
            ))
        }

        return {
            "general": general_stats,
            "user_specific": user_stats,
            "last_updated": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get vector statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")


@router.get("/health")
async def vector_health_check():
    """Check vector database health and status."""
    try:
        # Check vector store health
        vector_healthy = await vector_store.health_check()

        # Check embedding service health
        embedding_service = await get_embedding_service()
        embedding_healthy = await embedding_service.health_check()

        # Get collection info
        collection_info = await vector_store.get_collection_info()

        overall_health = "healthy" if vector_healthy and embedding_healthy else "degraded"

        return {
            "status": overall_health,
            "vector_store": "connected" if vector_healthy else "disconnected",
            "embedding_service": "available" if embedding_healthy else "unavailable",
            "collection": collection_info,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Vector health check failed: {e}")
        raise HTTPException(status_code=503, detail="Vector service unavailable")


# Background task functions
async def log_search_analytics(
    user_id: str,
    query: str,
    method: str,
    results_count: int,
    search_time_ms: float,
    weights: Optional[Dict[str, float]] = None
):
    """Log search analytics in background."""
    try:
        # This would typically log to a database or analytics service
        logger.info(f"Search analytics - User: {user_id}, Query: {query[:50]}..., "
                   f"Method: {method}, Results: {results_count}, Time: {search_time_ms:.2f}ms")

    except Exception as e:
        logger.error(f"Failed to log search analytics: {e}")


async def process_indexed_document(document_id: str, user_id: str):
    """Background processing for newly indexed documents."""
    try:
        # This could include:
        # - Generating document summaries
        # - Extracting key topics
        # - Updating search indexes
        # - Sending notifications

        logger.info(f"Background processing for document {document_id} by user {user_id}")

    except Exception as e:
        logger.error(f"Background processing failed for document {document_id}: {e}")