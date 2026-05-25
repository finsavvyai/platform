"""
Vector database configuration and utilities for knowledge management
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorDatabase:
    """Vector database client wrapper for ChromaDB"""
    
    def __init__(self):
        self.client: Optional[chromadb.Client] = None
        self.executor = ThreadPoolExecutor(max_workers=4)
        self._connected = False
    
    async def connect(self):
        """Connect to ChromaDB"""
        try:
            # Create ChromaDB client
            if settings.ENVIRONMENT == "development":
                # Use in-memory database for development
                self.client = chromadb.Client(ChromaSettings(
                    chroma_db_impl="duckdb+parquet",
                    persist_directory="./chroma_db"
                ))
            else:
                # Use HTTP client for production
                self.client = chromadb.HttpClient(
                    host=settings.CHROMA_HOST,
                    port=settings.CHROMA_PORT
                )
            
            # Test connection by listing collections
            await self._run_sync(self.client.list_collections)
            self._connected = True
            logger.info("ChromaDB connection established")
            
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from ChromaDB"""
        if self.client and hasattr(self.client, 'close'):
            await self._run_sync(self.client.close)
        self._connected = False
        logger.info("ChromaDB connection closed")
    
    async def _run_sync(self, func, *args, **kwargs):
        """Run synchronous ChromaDB operations in thread pool"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, func, *args, **kwargs)
    
    async def create_collection(
        self, 
        name: str, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> chromadb.Collection:
        """Create a new collection"""
        if not self.client:
            await self.connect()
        
        try:
            collection = await self._run_sync(
                self.client.create_collection,
                name=name,
                metadata=metadata or {}
            )
            logger.info(f"Created collection: {name}")
            return collection
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.info(f"Collection {name} already exists, getting existing collection")
                return await self.get_collection(name)
            raise
    
    async def get_collection(self, name: str) -> chromadb.Collection:
        """Get an existing collection"""
        if not self.client:
            await self.connect()
        
        return await self._run_sync(self.client.get_collection, name=name)
    
    async def delete_collection(self, name: str) -> None:
        """Delete a collection"""
        if not self.client:
            await self.connect()
        
        await self._run_sync(self.client.delete_collection, name=name)
        logger.info(f"Deleted collection: {name}")
    
    async def list_collections(self) -> List[chromadb.Collection]:
        """List all collections"""
        if not self.client:
            await self.connect()
        
        return await self._run_sync(self.client.list_collections)
    
    async def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None
    ) -> None:
        """Add documents to a collection"""
        collection = await self.get_collection(collection_name)
        
        await self._run_sync(
            collection.add,
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        logger.info(f"Added {len(documents)} documents to collection {collection_name}")
    
    async def query_documents(
        self,
        collection_name: str,
        query_texts: List[str],
        n_results: int = 10,
        where: Optional[Dict[str, Any]] = None,
        include: List[str] = ["documents", "metadatas", "distances"]
    ) -> Dict[str, Any]:
        """Query documents from a collection"""
        collection = await self.get_collection(collection_name)
        
        results = await self._run_sync(
            collection.query,
            query_texts=query_texts,
            n_results=n_results,
            where=where,
            include=include
        )
        
        logger.info(f"Queried {len(query_texts)} texts from collection {collection_name}")
        return results
    
    async def update_documents(
        self,
        collection_name: str,
        ids: List[str],
        documents: Optional[List[str]] = None,
        metadatas: Optional[List[Dict[str, Any]]] = None
    ) -> None:
        """Update documents in a collection"""
        collection = await self.get_collection(collection_name)
        
        await self._run_sync(
            collection.update,
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Updated {len(ids)} documents in collection {collection_name}")
    
    async def delete_documents(
        self,
        collection_name: str,
        ids: Optional[List[str]] = None,
        where: Optional[Dict[str, Any]] = None
    ) -> None:
        """Delete documents from a collection"""
        collection = await self.get_collection(collection_name)
        
        await self._run_sync(
            collection.delete,
            ids=ids,
            where=where
        )
        logger.info(f"Deleted documents from collection {collection_name}")
    
    async def get_collection_count(self, collection_name: str) -> int:
        """Get the number of documents in a collection"""
        collection = await self.get_collection(collection_name)
        return await self._run_sync(collection.count)
    
    async def health_check(self) -> bool:
        """Check if the vector database is healthy"""
        try:
            if not self.client:
                await self.connect()
            
            # Try to list collections as a health check
            await self._run_sync(self.client.list_collections)
            return True
        except Exception as e:
            logger.error(f"Vector database health check failed: {e}")
            return False


# Global vector database instance
vector_db = VectorDatabase()


class KnowledgeManager:
    """High-level knowledge management interface"""
    
    def __init__(self, vector_db: VectorDatabase):
        self.vector_db = vector_db
        self.default_collection = "knowledge_base"
    
    async def initialize(self):
        """Initialize the knowledge manager"""
        await self.vector_db.connect()
        
        # Create default collections
        await self.vector_db.create_collection(
            self.default_collection,
            metadata={"description": "Main knowledge base for UPM.Plus"}
        )
        
        # Create specialized collections
        await self.vector_db.create_collection(
            "workflows",
            metadata={"description": "Workflow templates and patterns"}
        )
        
        await self.vector_db.create_collection(
            "documentation",
            metadata={"description": "System documentation and help content"}
        )
        
        logger.info("Knowledge manager initialized")
    
    async def add_knowledge(
        self,
        content: str,
        metadata: Dict[str, Any],
        collection: str = None
    ) -> str:
        """Add knowledge to the database"""
        collection_name = collection or self.default_collection
        
        # Generate ID based on content hash
        import hashlib
        doc_id = hashlib.sha256(content.encode()).hexdigest()[:16]
        
        await self.vector_db.add_documents(
            collection_name=collection_name,
            documents=[content],
            metadatas=[metadata],
            ids=[doc_id]
        )
        
        return doc_id
    
    async def search_knowledge(
        self,
        query: str,
        collection: str = None,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for relevant knowledge"""
        collection_name = collection or self.default_collection
        
        results = await self.vector_db.query_documents(
            collection_name=collection_name,
            query_texts=[query],
            n_results=limit,
            where=filters
        )
        
        # Format results
        formatted_results = []
        if results.get("documents") and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                result = {
                    "content": doc,
                    "distance": results["distances"][0][i] if results.get("distances") else None,
                    "metadata": results["metadatas"][0][i] if results.get("metadatas") else {}
                }
                formatted_results.append(result)
        
        return formatted_results
    
    async def search_documents(
        self,
        query: str,
        collection: str = None,
        limit: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for documents (alias for search_knowledge for compatibility)"""
        return await self.search_knowledge(query, collection, limit, filters)
    
    async def update_knowledge(
        self,
        doc_id: str,
        content: str = None,
        metadata: Dict[str, Any] = None,
        collection: str = None
    ) -> None:
        """Update existing knowledge"""
        collection_name = collection or self.default_collection
        
        await self.vector_db.update_documents(
            collection_name=collection_name,
            ids=[doc_id],
            documents=[content] if content else None,
            metadatas=[metadata] if metadata else None
        )
    
    async def delete_knowledge(
        self,
        doc_id: str,
        collection: str = None
    ) -> None:
        """Delete knowledge from the database"""
        collection_name = collection or self.default_collection
        
        await self.vector_db.delete_documents(
            collection_name=collection_name,
            ids=[doc_id]
        )


# Global knowledge manager instance
knowledge_manager = KnowledgeManager(vector_db)