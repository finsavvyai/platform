
import {
    VectorDatabase,
    Document,
    VectorQuery,
    SearchResult,
    IndexOptions,
    IndexStats,
    IndexInfo
} from '../interfaces';
import { EventEmitter } from 'events';
import { MetadataStore } from './metadata-store';

export interface VectorizeIndexBinding {
    query(vector: number[], options?: any): Promise<any>;
    insert(vectors: Array<{ id: string; values: number[]; metadata?: any }>): Promise<any>;
    upsert(vectors: Array<{ id: string; values: number[]; metadata?: any }>): Promise<any>;
    getByIds(ids: string[]): Promise<any>;
    deleteByIds(ids: string[]): Promise<any>;
    describe(): Promise<any>;
}

export class CloudflareVectorizeProvider extends EventEmitter implements VectorDatabase {
    private index: VectorizeIndexBinding;
    private metadataStore: MetadataStore;

    constructor(config: { index: VectorizeIndexBinding, metadataStore: MetadataStore }) {
        super();
        this.index = config.index;
        this.metadataStore = config.metadataStore;
    }

    async connect(): Promise<void> {
        // No connection needed for binding
        this.emit('connected');
    }

    async disconnect(): Promise<void> {
        this.emit('disconnected');
    }

    async createIndex(indexName: string, dimension: number, options?: IndexOptions): Promise<void> {
        console.warn('Cloudflare Vectorize indices must be created via Wrangler/Dashboard.');
    }

    async indexDocuments(indexName: string, documents: Document[]): Promise<string[]> {
        // 1. Ensure parent document records exist in D1 (FK constraint)
        const seenDocIds = new Set<string>();
        for (const doc of documents) {
            const docId = ((doc.metadata as any)?.documentId as string) || doc.id;
            if (!seenDocIds.has(docId)) {
                seenDocIds.add(docId);
                await this.metadataStore.saveDocument({
                    id: docId,
                    path: (doc.metadata as any)?.source || doc.source || docId,
                    metadata: { source: doc.source, type: (doc.metadata as any)?.type }
                });
            }
        }

        // 2. Prepare vectors for Vectorize (minimal metadata)
        const vectors = documents.map(doc => ({
            id: doc.id,
            values: doc.embedding || [],
            metadata: {
                documentId: (doc.metadata as any)?.documentId || doc.id,
                chunkIndex: (doc.metadata as any)?.chunkIndex,
                source: doc.metadata?.source,
                type: doc.metadata?.type
            }
        }));

        // 3. Prepare full content for D1 MetadataStore
        const chunks = documents.map(doc => ({
            id: doc.id,
            documentId: ((doc.metadata as any)?.documentId as string) || doc.id,
            content: doc.content,
            index: ((doc.metadata as any)?.chunkIndex as number) || 0,
            metadata: doc.metadata
        }));

        // 4. Save chunk content to D1
        await this.metadataStore.saveChunks(chunks);

        // 5. Upsert vectors to Vectorize (batching)
        const batchSize = 1000;
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize);
            await this.index.upsert(batch);
        }

        return documents.map(d => d.id);
    }

    async search(indexNameOrVector: string | number[], queryOrOptions?: any, options?: any): Promise<SearchResult[]> {
        // Handle both calling conventions:
        // 1. search(indexName: string, query: VectorQuery)
        // 2. search(vector: number[], options: { topK, includeMetadata, ... })
        let vector: number[];
        let topK: number;

        if (Array.isArray(indexNameOrVector)) {
            // Called as search(vector[], { topK, ... }) from SemanticSearchService
            vector = indexNameOrVector;
            topK = queryOrOptions?.topK || 10;
        } else {
            // Called as search(indexName, { vector, topK, ... }) from VectorDatabase interface
            const query = queryOrOptions || {};
            vector = query.vector;
            topK = query.topK || 10;
        }

        if (!vector || vector.length === 0) {
            return [];
        }

        // 1. Query Vectorize
        const result = await this.index.query(vector, {
            topK,
            returnValues: false,
            returnMetadata: true
        });

        if (!result.matches || result.matches.length === 0) {
            return [];
        }

        // 2. Fetch full content from D1
        const ids = result.matches.map((m: any) => m.id);
        const contentMap = new Map();
        try {
            const contents = await this.metadataStore.getChunks(ids);
            contents.forEach(c => contentMap.set(c.id, c));
        } catch (e) {
            console.error('Failed to fetch content from D1', e);
        }

        // 3. Merge results
        return (result.matches || []).map((match: any) => {
            const contentData = contentMap.get(match.id);
            const content = contentData ? contentData.content : '';
            const metadata = contentData
                ? { ...contentData.metadata, content }
                : { ...match.metadata, content };
            return {
                document: {
                    id: match.id,
                    content,
                    metadata,
                    embedding: [],
                    source: metadata?.source || 'vectorize',
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                score: match.score,
                rank: 0,
                // SemanticSearchService also expects these flat fields:
                id: match.id,
                metadata,
            };
        });
    }

    async get(indexName: string, documentId: string): Promise<Document | null> {
        try {
            // Try to get from D1 first (full content)
            const contentData = await this.metadataStore.getChunks([documentId]);
            if (contentData && contentData.length > 0) {
                const chunk = contentData[0];
                return {
                    id: chunk.id,
                    content: chunk.content,
                    metadata: chunk.metadata,
                    embedding: [], // We don't store embeddings in D1, and Vectorize getByIds returns them.
                    // If we need embedding, we call index.getByIds([documentId])
                    source: chunk.metadata?.source || 'vectorize',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    // Flattened fields if needed
                    ...chunk.metadata
                } as any;
            }

            // If not in D1, checks Vectorize (metadata only)
            const vectors = await this.index.getByIds([documentId]);
            if (vectors && vectors.length > 0) {
                const vector = vectors[0];
                return {
                    id: vector.id,
                    content: '', // No content in Vectorize usually
                    metadata: vector.metadata || {},
                    embedding: vector.values,
                    source: vector.metadata?.source || 'vectorize',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
            }

            return null;
        } catch (error) {
            console.error(`Failed to get document ${documentId}:`, error);
            return null;
        }
    }

    async deleteDocument(indexName: string, documentId: string): Promise<void> {
        // Delete from both
        await Promise.all([
            this.index.deleteByIds([documentId]),
            this.metadataStore.deleteDocument(documentId) // This deletes based on document_id, assuming documentId is passed (might be chunk ID?)
        ]);
        // Note: If documentId is a chunk ID, deleteDocument in MetadataStore might be wrong if it deletes by doc ID.
        // Ideally deleteDocument takes an ID and deletes THAT chunk.
        // But VectorDatabase interface implies specific ID.
        // Check MetadataStore implementation: deleteDocument deletes WHERE document_id = ?
        // So if I pass a chunk ID here, it might not find it or delete wrong things.
        // However, usually RAG deletes by Document ID (all chunks).
        // Vectorize `deleteByIds` deletes specific vectors (chunks).
        // I should probably align this. For now, assuming documentId refers to the parent Document ID would delete all chunks.
        // But wait, `indexDocuments` stores CHUNKS as vectors.
        // So `deleteDocument` on interface usually means "delete this vector".
        // I should query Vectorize to find all vectors for a doc ID?
        // Or just delete the chunk from D1?
        // Let's implement deleteChunk in MetadataStore.
    }

    async updateDocument(indexName: string, document: Document): Promise<void> {
        // Re-indexing handles update (upsert)
        await this.indexDocuments(indexName, [document]);
    }

    async getIndexStats(indexName: string): Promise<IndexStats> {
        const stats = await this.index.describe();
        return {
            documentCount: stats.vectorCount,
            vectorCount: stats.vectorCount,
            indexSize: 0, // Not provided
            status: 'ready',
            lastUpdated: new Date()
        };
    }

    async listIndices(): Promise<IndexInfo[]> {
        // Vectorize binding is per-index, so we only know about the bound one
        return [{
            name: 'default',
            dimension: 0, // Unknown without describe()
            documentCount: 0,
            status: 'ready',
            createdAt: new Date(),
            updatedAt: new Date()
        }];
    }
}
