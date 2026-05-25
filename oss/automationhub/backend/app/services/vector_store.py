"""
Enhanced vector store service for knowledge management with semantic search capabilities
"""

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from typing import List, Dict, Any, Optional, Tuple
import logging
import uuid
import numpy as np
from datetime import datetime, timedelta
import json
from sentence_transformers import SentenceTransformer
import asyncio

from app.core.config import settings
from app.services.embedding import EmbeddingService, get_embedding_service
from app.services.cache_service import CacheService

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Enhanced service for vector database operations with semantic search"""

    def __init__(self):
        self.client = None
        self.collection = None
        self.embedding_service = None
        self.cache_service = CacheService()
        self._initialize_client()
        self._initialize_embeddings()

    def _initialize_embeddings(self):
        """Initialize embedding service"""
        try:
            self.embedding_service = EmbeddingService()
            logger.info("Embedding service initialized for vector store")
        except Exception as e:
            logger.error(f"Failed to initialize embedding service: {e}")
            self.embedding_service = None
    
    def _initialize_client(self):
        """Initialize ChromaDB client"""
        try:
            # Configure ChromaDB client
            chroma_settings = Settings(
                chroma_server_host=settings.CHROMA_HOST,
                chroma_server_http_port=settings.CHROMA_PORT,
                chroma_api_impl="rest"
            )
            
            self.client = chromadb.Client(chroma_settings)
            
            # Get or create default collection
            self.collection = self.client.get_or_create_collection(
                name="upm_plus_documents",
                metadata={"description": "UPM.Plus document embeddings"}
            )
            
            logger.info("ChromaDB client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            self.client = None
            self.collection = None
    
    async def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
        embeddings: Optional[List[List[float]]] = None
    ) -> bool:
        """Add documents to vector store"""
        try:
            if not self.collection:
                raise ValueError("Vector store not initialized")
            
            # Generate IDs if not provided
            if not ids:
                ids = [str(uuid.uuid4()) for _ in documents]
            
            # Add documents to collection
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
                embeddings=embeddings
            )
            
            logger.info(f"Added {len(documents)} documents to vector store")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add documents to vector store: {e}")
            return False
    
    async def search_documents(
        self,
        query: str,
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
        query_embeddings: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """Search documents in vector store"""
        try:
            if not self.collection:
                raise ValueError("Vector store not initialized")
            
            # Perform search
            if query_embeddings:
                results = self.collection.query(
                    query_embeddings=[query_embeddings],
                    n_results=n_results,
                    where=where
                )
            else:
                results = self.collection.query(
                    query_texts=[query],
                    n_results=n_results,
                    where=where
                )
            
            return {
                "documents": results["documents"][0] if results["documents"] else [],
                "metadatas": results["metadatas"][0] if results["metadatas"] else [],
                "distances": results["distances"][0] if results["distances"] else [],
                "ids": results["ids"][0] if results["ids"] else []
            }
            
        except Exception as e:
            logger.error(f"Failed to search documents in vector store: {e}")
            return {
                "documents": [],
                "metadatas": [],
                "distances": [],
                "ids": []
            }
    
    async def delete_documents(self, ids: List[str]) -> bool:
        """Delete documents from vector store"""
        try:
            if not self.collection:
                raise ValueError("Vector store not initialized")
            
            self.collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents from vector store")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete documents from vector store: {e}")
            return False
    
    async def update_documents(
        self,
        ids: List[str],
        documents: Optional[List[str]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None,
        embeddings: Optional[List[List[float]]] = None
    ) -> bool:
        """Update documents in vector store"""
        try:
            if not self.collection:
                raise ValueError("Vector store not initialized")
            
            self.collection.update(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
            
            logger.info(f"Updated {len(ids)} documents in vector store")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update documents in vector store: {e}")
            return False
    
    async def get_collection_info(self) -> Dict[str, Any]:
        """Get information about the collection"""
        try:
            if not self.collection:
                return {"error": "Vector store not initialized"}
            
            count = self.collection.count()
            return {
                "name": self.collection.name,
                "count": count,
                "metadata": self.collection.metadata
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return {"error": str(e)}
    
    async def health_check(self) -> bool:
        """Check if vector store is healthy"""
        try:
            if not self.client:
                return False

            # Try to get collection info
            info = await self.get_collection_info()
            return "error" not in info

        except Exception as e:
            logger.error(f"Vector store health check failed: {e}")
            return False

    # Enhanced methods for Task 1.4.2 - Vector Database Integration

    async def add_document_with_embeddings(
        self,
        document_id: str,
        title: str,
        content: str,
        metadata: Dict[str, Any],
        chunk_size: int = 500,
        overlap: int = 50
    ) -> Dict[str, Any]:
        """Add document with automatic embedding generation and chunking"""
        try:
            if not self.embedding_service:
                raise ValueError("Embedding service not available")

            # Generate document embeddings with chunking
            chunk_data = await self.embedding_service.generate_document_embeddings(
                document_id=document_id,
                title=title,
                content=content,
                metadata=metadata,
                chunk_size=chunk_size,
                overlap=overlap
            )

            if not chunk_data:
                return {"success": False, "error": "Failed to generate embeddings"}

            # Prepare data for vector store
            documents = [chunk["text"] for chunk in chunk_data]
            embeddings = [chunk["embedding"] for chunk in chunk_data]
            metadatas = [chunk["metadata"] for chunk in chunk_data]
            ids = [chunk["id"] for chunk in chunk_data]

            # Add to vector store
            success = await self.add_documents(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )

            if success:
                logger.info(f"Successfully added document {document_id} with {len(chunk_data)} chunks")
                return {
                    "success": True,
                    "document_id": document_id,
                    "chunks_added": len(chunk_data),
                    "chunk_ids": ids
                }
            else:
                return {"success": False, "error": "Failed to add to vector store"}

        except Exception as e:
            logger.error(f"Failed to add document with embeddings: {e}")
            return {"success": False, "error": str(e)}

    async def semantic_search(
        self,
        query: str,
        n_results: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        similarity_threshold: float = 0.7,
        include_scores: bool = True
    ) -> Dict[str, Any]:
        """Perform semantic search with similarity scoring"""
        try:
            if not self.collection:
                return {"error": "Vector store not initialized"}

            # Generate query embedding
            if self.embedding_service:
                query_embedding = await self.embedding_service.generate_embeddings(query)
            else:
                # Fall back to built-in embedding
                query_embedding = None

            # Perform search
            if query_embedding:
                results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=n_results * 2,  # Get more to filter
                    where=filters
                )
            else:
                results = self.collection.query(
                    query_texts=[query],
                    n_results=n_results * 2,
                    where=filters
                )

            # Process and filter results
            processed_results = []
            documents = results["documents"][0] if results["documents"] else []
            metadatas = results["metadatas"][0] if results["metadatas"] else []
            distances = results["distances"][0] if results["distances"] else []
            ids = results["ids"][0] if results["ids"] else []

            for i, (doc, meta, dist, doc_id) in enumerate(zip(documents, metadatas, distances, ids)):
                # Convert distance to similarity score (cosine similarity = 1 - distance)
                similarity = 1 - dist if dist else 0

                if similarity >= similarity_threshold:
                    result_item = {
                        "id": doc_id,
                        "content": doc,
                        "metadata": meta,
                        "rank": i + 1
                    }

                    if include_scores:
                        result_item["similarity_score"] = similarity
                        result_item["distance"] = dist

                    processed_results.append(result_item)

            # Limit to requested number of results
            processed_results = processed_results[:n_results]

            return {
                "query": query,
                "results": processed_results,
                "total_found": len(processed_results),
                "search_method": "semantic"
            }

        except Exception as e:
            logger.error(f"Failed to perform semantic search: {e}")
            return {"error": str(e), "results": []}

    async def hybrid_search(
        self,
        query: str,
        text_weight: float = 0.3,
        vector_weight: float = 0.7,
        n_results: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Perform hybrid search combining text and vector search"""
        try:
            # Perform semantic search
            semantic_results = await self.semantic_search(
                query=query,
                n_results=n_results * 2,
                filters=filters,
                include_scores=True
            )

            # Perform text-based search (using ChromaDB's built-in text search)
            text_results = await self.search_documents(
                query=query,
                n_results=n_results * 2,
                where=filters
            )

            # Combine and re-score results
            combined_scores = {}
            all_results = {}

            # Process semantic results
            for result in semantic_results.get("results", []):
                doc_id = result["id"]
                semantic_score = result.get("similarity_score", 0)
                combined_scores[doc_id] = semantic_score * vector_weight
                all_results[doc_id] = result

            # Process text results and combine scores
            text_docs = text_results.get("documents", [])
            text_metas = text_results.get("metadatas", [])
            text_distances = text_results.get("distances", [])
            text_ids = text_results.get("ids", [])

            for i, (doc, meta, dist, doc_id) in enumerate(zip(text_docs, text_metas, text_distances, text_ids)):
                # Convert distance to relevance score
                text_score = 1 - dist if dist else 0

                if doc_id in combined_scores:
                    combined_scores[doc_id] += text_score * text_weight
                else:
                    combined_scores[doc_id] = text_score * text_weight
                    all_results[doc_id] = {
                        "id": doc_id,
                        "content": doc,
                        "metadata": meta,
                        "similarity_score": text_score,
                        "distance": dist
                    }

            # Sort by combined score and return top results
            sorted_results = sorted(
                combined_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:n_results]

            final_results = []
            for doc_id, combined_score in sorted_results:
                result = all_results[doc_id].copy()
                result["combined_score"] = combined_score
                result["search_method"] = "hybrid"
                final_results.append(result)

            return {
                "query": query,
                "results": final_results,
                "total_found": len(final_results),
                "search_method": "hybrid",
                "weights": {"text": text_weight, "vector": vector_weight}
            }

        except Exception as e:
            logger.error(f"Failed to perform hybrid search: {e}")
            return {"error": str(e), "results": []}

    async def find_similar_documents(
        self,
        document_id: str,
        n_results: int = 10,
        similarity_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """Find documents similar to a given document"""
        try:
            # Get the document's embeddings
            results = self.collection.query(
                query_texts=[f"document_id:{document_id}"],
                n_results=1
            )

            if not results["documents"] or not results["documents"][0]:
                return {"error": f"Document {document_id} not found"}

            # Use the first chunk as reference
            reference_doc = results["documents"][0][0]
            reference_embedding = results.get("embeddings", [[[]]])[0][0] if results.get("embeddings") else None

            if reference_embedding:
                # Use embedding for similarity search
                similar_results = self.collection.query(
                    query_embeddings=[reference_embedding],
                    n_results=n_results + 1,  # +1 to exclude the original
                    where={"document_id": {"$ne": document_id}}
                )
            else:
                # Fall back to text similarity
                similar_results = self.collection.query(
                    query_texts=[reference_doc],
                    n_results=n_results + 1,
                    where={"document_id": {"$ne": document_id}}
                )

            # Process results
            similar_docs = []
            documents = similar_results["documents"][0] if similar_results["documents"] else []
            metadatas = similar_results["metadatas"][0] if similar_results["metadatas"] else []
            distances = similar_results["distances"][0] if similar_results["distances"] else []

            for doc, meta, dist in zip(documents, metadatas, distances):
                similarity = 1 - dist if dist else 0
                if similarity >= similarity_threshold:
                    similar_docs.append({
                        "content": doc,
                        "metadata": meta,
                        "similarity_score": similarity
                    })

            return {
                "document_id": document_id,
                "similar_documents": similar_docs[:n_results],
                "total_found": len(similar_docs)
            }

        except Exception as e:
            logger.error(f"Failed to find similar documents: {e}")
            return {"error": str(e)}

    async def update_document_embeddings(
        self,
        document_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update document embeddings in real-time"""
        try:
            # Get existing chunks for the document
            existing_results = self.collection.query(
                query_texts=[f"document_id:{document_id}"],
                n_results=1000  # Get all chunks
            )

            if existing_results["ids"] and existing_results["ids"][0]:
                existing_chunk_ids = existing_results["ids"][0]

                # Delete existing embeddings
                await self.delete_documents(existing_chunk_ids)
                logger.info(f"Deleted {len(existing_chunk_ids)} existing chunks for document {document_id}")

            # If new content provided, re-add with updated embeddings
            if content:
                new_metadata = metadata or {}
                if title:
                    new_metadata["title"] = title
                new_metadata["updated_at"] = datetime.utcnow().isoformat()

                result = await self.add_document_with_embeddings(
                    document_id=document_id,
                    title=title or "Updated Document",
                    content=content,
                    metadata=new_metadata
                )

                return {
                    "success": True,
                    "action": "updated",
                    "document_id": document_id,
                    **result
                }
            else:
                return {
                    "success": True,
                    "action": "deleted",
                    "document_id": document_id,
                    "deleted_chunks": len(existing_chunk_ids) if existing_chunk_ids else 0
                }

        except Exception as e:
            logger.error(f"Failed to update document embeddings: {e}")
            return {"success": False, "error": str(e)}

    async def batch_update_embeddings(
        self,
        updates: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Batch update multiple document embeddings"""
        try:
            results = []
            success_count = 0
            error_count = 0

            for update in updates:
                document_id = update.get("document_id")
                if not document_id:
                    results.append({"success": False, "error": "Missing document_id"})
                    error_count += 1
                    continue

                result = await self.update_document_embeddings(
                    document_id=document_id,
                    title=update.get("title"),
                    content=update.get("content"),
                    metadata=update.get("metadata")
                )

                results.append(result)
                if result.get("success"):
                    success_count += 1
                else:
                    error_count += 1

            return {
                "success": True,
                "total_updates": len(updates),
                "successful": success_count,
                "failed": error_count,
                "results": results
            }

        except Exception as e:
            logger.error(f"Failed to batch update embeddings: {e}")
            return {"success": False, "error": str(e)}

    async def get_document_statistics(self) -> Dict[str, Any]:
        """Get statistics about documents in vector store"""
        try:
            if not self.collection:
                return {"error": "Vector store not initialized"}

            # Get basic collection info
            collection_info = await self.get_collection_info()

            # Get unique document count and other statistics
            all_results = self.collection.get()

            unique_documents = set()
            total_chunks = 0
            documents_by_date = {}

            if all_results["metadatas"]:
                for metadata in all_results["metadatas"]:
                    doc_id = metadata.get("document_id")
                    if doc_id:
                        unique_documents.add(doc_id)

                    created_at = metadata.get("created_at")
                    if created_at:
                        date_key = created_at[:10]  # YYYY-MM-DD
                        documents_by_date[date_key] = documents_by_date.get(date_key, 0) + 1

                    total_chunks += 1

            return {
                "collection_info": collection_info,
                "unique_documents": len(unique_documents),
                "total_chunks": total_chunks,
                "average_chunks_per_document": total_chunks / len(unique_documents) if unique_documents else 0,
                "documents_by_date": documents_by_date,
                "last_updated": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to get document statistics: {e}")
            return {"error": str(e)}

    # Real-time indexing updates for Task 1.4.2

    async def setup_real_time_indexing(self, webhook_url: Optional[str] = None) -> Dict[str, Any]:
        """Setup real-time indexing with webhook notifications"""
        try:
            # Store webhook configuration for real-time updates
            self.webhook_url = webhook_url

            # Initialize real-time indexing state
            self.indexing_queue = []
            self.indexing_active = True

            logger.info("Real-time indexing setup completed")
            return {
                "success": True,
                "message": "Real-time indexing enabled",
                "webhook_configured": webhook_url is not None
            }

        except Exception as e:
            logger.error(f"Failed to setup real-time indexing: {e}")
            return {"success": False, "error": str(e)}

    async def add_to_indexing_queue(
        self,
        operation: str,
        document_id: str,
        data: Dict[str, Any],
        priority: int = 1
    ) -> bool:
        """Add an operation to the real-time indexing queue"""
        try:
            if not hasattr(self, 'indexing_queue'):
                await self.setup_real_time_indexing()

            queue_item = {
                "operation": operation,  # "add", "update", "delete"
                "document_id": document_id,
                "data": data,
                "priority": priority,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "queued"
            }

            # Insert based on priority
            self.indexing_queue.append(queue_item)
            self.indexing_queue.sort(key=lambda x: x["priority"], reverse=True)

            # Trigger processing
            asyncio.create_task(self.process_indexing_queue())

            logger.info(f"Added {operation} operation for document {document_id} to indexing queue")
            return True

        except Exception as e:
            logger.error(f"Failed to add to indexing queue: {e}")
            return False

    async def process_indexing_queue(self) -> Dict[str, Any]:
        """Process the real-time indexing queue"""
        try:
            if not hasattr(self, 'indexing_queue') or not self.indexing_queue:
                return {"processed": 0, "message": "No items in queue"}

            processed_count = 0
            errors = []

            # Process queue items
            remaining_items = []
            for item in self.indexing_queue:
                try:
                    operation = item["operation"]
                    document_id = item["document_id"]
                    data = item["data"]

                    success = False

                    if operation == "add":
                        success = await self._process_add_operation(document_id, data)
                    elif operation == "update":
                        success = await self._process_update_operation(document_id, data)
                    elif operation == "delete":
                        success = await self._process_delete_operation(document_id, data)

                    if success:
                        processed_count += 1
                        item["status"] = "completed"

                        # Send webhook notification if configured
                        if hasattr(self, 'webhook_url') and self.webhook_url:
                            await self._send_webhook_notification(item)
                    else:
                        errors.append(f"Failed to process {operation} for {document_id}")
                        item["status"] = "failed"

                except Exception as e:
                    logger.error(f"Failed to process queue item {item.get('document_id')}: {e}")
                    errors.append(str(e))
                    item["status"] = "failed"

            # Clear processed items
            self.indexing_queue = remaining_items

            result = {
                "processed": processed_count,
                "errors": errors,
                "queue_size": len(self.indexing_queue),
                "timestamp": datetime.utcnow().isoformat()
            }

            logger.info(f"Processed {processed_count} items from indexing queue")
            return result

        except Exception as e:
            logger.error(f"Failed to process indexing queue: {e}")
            return {"processed": 0, "error": str(e)}

    async def _process_add_operation(self, document_id: str, data: Dict[str, Any]) -> bool:
        """Process add operation for real-time indexing"""
        try:
            title = data.get("title", "")
            content = data.get("content", "")
            metadata = data.get("metadata", {})

            result = await self.add_document_with_embeddings(
                document_id=document_id,
                title=title,
                content=content,
                metadata=metadata
            )

            return result.get("success", False)

        except Exception as e:
            logger.error(f"Failed to process add operation for {document_id}: {e}")
            return False

    async def _process_update_operation(self, document_id: str, data: Dict[str, Any]) -> bool:
        """Process update operation for real-time indexing"""
        try:
            title = data.get("title")
            content = data.get("content")
            metadata = data.get("metadata")

            result = await self.update_document_embeddings(
                document_id=document_id,
                title=title,
                content=content,
                metadata=metadata
            )

            return result.get("success", False)

        except Exception as e:
            logger.error(f"Failed to process update operation for {document_id}: {e}")
            return False

    async def _process_delete_operation(self, document_id: str, data: Dict[str, Any]) -> bool:
        """Process delete operation for real-time indexing"""
        try:
            # Get all chunks for the document
            search_results = await self.search_documents(
                query=f"document_id:{document_id}",
                n_results=1000
            )

            if search_results.get("ids"):
                return await self.delete_documents(search_results["ids"])

            return True  # Document not found, consider it deleted

        except Exception as e:
            logger.error(f"Failed to process delete operation for {document_id}: {e}")
            return False

    async def _send_webhook_notification(self, queue_item: Dict[str, Any]):
        """Send webhook notification for completed indexing operation"""
        try:
            if not hasattr(self, 'webhook_url') or not self.webhook_url:
                return

            import httpx

            payload = {
                "event": "indexing_completed",
                "operation": queue_item["operation"],
                "document_id": queue_item["document_id"],
                "status": queue_item["status"],
                "timestamp": queue_item["timestamp"]
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code == 200:
                    logger.info(f"Webhook notification sent for {queue_item['document_id']}")
                else:
                    logger.warning(f"Webhook notification failed: {response.status_code}")

        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")

    async def get_indexing_queue_status(self) -> Dict[str, Any]:
        """Get current status of the indexing queue"""
        try:
            if not hasattr(self, 'indexing_queue'):
                return {"queue_enabled": False, "message": "Indexing queue not initialized"}

            queue_stats = {
                "queue_enabled": True,
                "queue_size": len(self.indexing_queue),
                "items_by_status": {},
                "items_by_operation": {},
                "webhook_configured": hasattr(self, 'webhook_url') and self.webhook_url is not None
            }

            # Analyze queue items
            for item in self.indexing_queue:
                status = item["status"]
                operation = item["operation"]

                queue_stats["items_by_status"][status] = queue_stats["items_by_status"].get(status, 0) + 1
                queue_stats["items_by_operation"][operation] = queue_stats["items_by_operation"].get(operation, 0) + 1

            return queue_stats

        except Exception as e:
            logger.error(f"Failed to get indexing queue status: {e}")
            return {"error": str(e)}

    async def enable_auto_indexing(
        self,
        check_interval: int = 30,
        max_batch_size: int = 10
    ) -> Dict[str, Any]:
        """Enable automatic background indexing"""
        try:
            self.auto_indexing_enabled = True
            self.check_interval = check_interval
            self.max_batch_size = max_batch_size

            # Start background task for auto-indexing
            asyncio.create_task(self._auto_indexing_loop())

            logger.info(f"Auto-indexing enabled with {check_interval}s interval")
            return {
                "success": True,
                "message": "Auto-indexing enabled",
                "check_interval": check_interval,
                "max_batch_size": max_batch_size
            }

        except Exception as e:
            logger.error(f"Failed to enable auto-indexing: {e}")
            return {"success": False, "error": str(e)}

    async def _auto_indexing_loop(self):
        """Background loop for automatic indexing"""
        while getattr(self, 'auto_indexing_enabled', False):
            try:
                if hasattr(self, 'indexing_queue') and self.indexing_queue:
                    # Process a batch of items
                    batch_size = min(getattr(self, 'max_batch_size', 10), len(self.indexing_queue))
                    if batch_size > 0:
                        batch = self.indexing_queue[:batch_size]
                        self.indexing_queue = self.indexing_queue[batch_size:]

                        # Process batch
                        for item in batch:
                            operation = item["operation"]
                            document_id = item["document_id"]
                            data = item["data"]

                            if operation == "add":
                                await self._process_add_operation(document_id, data)
                            elif operation == "update":
                                await self._process_update_operation(document_id, data)
                            elif operation == "delete":
                                await self._process_delete_operation(document_id, data)

                # Sleep before next check
                await asyncio.sleep(getattr(self, 'check_interval', 30))

            except Exception as e:
                logger.error(f"Auto-indexing loop error: {e}")
                await asyncio.sleep(60)  # Wait longer on error

    async def disable_auto_indexing(self) -> Dict[str, Any]:
        """Disable automatic background indexing"""
        try:
            self.auto_indexing_enabled = False
            logger.info("Auto-indexing disabled")
            return {
                "success": True,
                "message": "Auto-indexing disabled"
            }

        except Exception as e:
            logger.error(f"Failed to disable auto-indexing: {e}")
            return {"success": False, "error": str(e)}