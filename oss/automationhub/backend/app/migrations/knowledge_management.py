"""
Knowledge Management Database Migration for UPM.Plus
"""

from app.core.d1_migrations import Migration
from app.services.knowledge_models import KNOWLEDGE_MANAGEMENT_SCHEMA


class CreateKnowledgeManagementTables(Migration):
    """Create knowledge management tables"""
    
    version = "001"
    description = "Create knowledge_base, document_processing_jobs, document_tags, and search_history tables"
    
    async def up(self):
        """Create the knowledge management tables"""
        await self.execute_sql(KNOWLEDGE_MANAGEMENT_SCHEMA)
        
        # Insert some initial data
        await self.execute_sql("""
            INSERT INTO document_processing_jobs (id, document_id, status, progress, chunks_processed, total_chunks)
            SELECT 
                'job_' || LOWER(HEX(RANDOMBLOB(16))),
                id,
                'pending',
                0,
                0,
                0
            FROM documents
            WHERE embedding_status = 'pending'
            LIMIT 5;
        """)
    
    async def down(self):
        """Drop the knowledge management tables"""
        await self.execute_sql("""
            DROP TABLE IF EXISTS search_history;
            DROP TABLE IF EXISTS document_tags;
            DROP TABLE IF EXISTS document_processing_jobs;
            DROP TABLE IF EXISTS knowledge_base;
        """)


class AddDocumentEmbeddingIndexes(Migration):
    """Add indexes for better document search performance"""
    
    version = "002"
    description = "Add performance indexes for document embeddings"
    
    async def up(self):
        """Create performance indexes"""
        await self.execute_sql("""
            CREATE INDEX IF NOT EXISTS idx_documents_embedding_status ON documents(embedding_status);
            CREATE INDEX IF NOT EXISTS idx_documents_owner_embedding ON documents(owner_id, embedding_status);
            CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_id ON knowledge_base(embedding_id);
            CREATE INDEX IF NOT EXISTS idx_document_tags_document_tag ON document_tags(document_id, tag);
        """)
    
    async def down(self):
        """Drop performance indexes"""
        await self.execute_sql("""
            DROP INDEX IF EXISTS idx_documents_embedding_status;
            DROP INDEX IF EXISTS idx_documents_owner_embedding;
            DROP INDEX IF EXISTS idx_knowledge_base_embedding_id;
            DROP INDEX IF EXISTS idx_document_tags_document_tag;
        """)


class AddDocumentSearchView(Migration):
    """Create a view for efficient document searching"""
    
    version = "003"
    description = "Create document search view with pre-joined data"
    
    async def up(self):
        """Create search view"""
        await self.execute_sql("""
            CREATE VIEW IF NOT EXISTS document_search_view AS
            SELECT 
                d.id as document_id,
                d.title,
                d.content,
                d.metadata,
                d.owner_id,
                d.embedding_status,
                d.created_at,
                d.updated_at,
                COUNT(kb.id) as chunk_count,
                GROUP_CONCAT(dt.tag) as tags
            FROM documents d
            LEFT JOIN knowledge_base kb ON d.id = kb.document_id
            LEFT JOIN document_tags dt ON d.id = dt.document_id
            WHERE d.is_active = 1
            GROUP BY d.id, d.title, d.content, d.metadata, d.owner_id, d.embedding_status, d.created_at, d.updated_at;
        """)
    
    async def down(self):
        """Drop search view"""
        await self.execute_sql("""
            DROP VIEW IF EXISTS document_search_view;
        """)


# Register migrations
MIGRATIONS = [
    CreateKnowledgeManagementTables,
    AddDocumentEmbeddingIndexes,
    AddDocumentSearchView,
]
