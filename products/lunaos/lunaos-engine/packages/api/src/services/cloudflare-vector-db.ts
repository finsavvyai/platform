/**
 * Cloudflare-optimized Vector Database Service
 * Uses KV for small datasets with external provider fallback.
 */

import {
    cosineSimilarity,
    hashVector,
    generateSimpleEmbedding,
    generateFallbackEmbedding,
} from './vector-math';

interface VectorDBEnv {
    OPENAI_API_KEY?: string;
    RAG_CACHE: KVNamespace;
    QDRANT_URL?: string;
    QDRANT_API_KEY?: string;
}

interface SearchResult {
    id: string;
    title: string;
    content: string;
    score: number;
    metadata: Record<string, any>;
}

export class CloudflareVectorDB {
    private fallbackProvider: any;

    constructor() {
        this.fallbackProvider = null;
    }

    async generateEmbedding(text: string, env: VectorDBEnv): Promise<number[]> {
        if (env.OPENAI_API_KEY) {
            return generateSimpleEmbedding(text);
        }
        return generateFallbackEmbedding(text);
    }

    async addDocuments(documents: any[], env: VectorDBEnv): Promise<string[]> {
        const embeddings = [];

        for (const doc of documents) {
            const embedding = await this.generateEmbedding(doc.content, env);
            embeddings.push({
                id: doc.id,
                vector: embedding,
                title: doc.title,
                content: doc.content,
                metadata: doc.metadata,
            });
        }

        await env.RAG_CACHE.put('documents', JSON.stringify(embeddings));

        if (env.QDRANT_URL && env.QDRANT_API_KEY) {
            return this.addToExternalProvider(embeddings);
        }

        return documents.map((doc: any) => doc.id);
    }

    async search(queryEmbedding: number[], options: any, env: VectorDBEnv): Promise<SearchResult[]> {
        const { topK = 5, filters = {} } = options;

        const cacheKey = `search:${hashVector(queryEmbedding)}:${JSON.stringify(filters)}`;
        const cached = await env.RAG_CACHE.get(cacheKey, 'json') as { timestamp: number; results: SearchResult[] } | null;

        if (cached && cached.timestamp > Date.now() - 300000) {
            return cached.results;
        }

        const results = await this.searchKV(queryEmbedding, topK, env);

        if (results.length > 0) {
            await env.RAG_CACHE.put(cacheKey, JSON.stringify({ timestamp: Date.now(), results }));
        }

        if (env.QDRANT_URL && env.QDRANT_API_KEY) {
            return this.searchExternalProvider(queryEmbedding, options);
        }

        return results;
    }

    async deleteDocument(id: string, env: VectorDBEnv): Promise<void> {
        const docs = await env.RAG_CACHE.get('documents', 'text');
        const parsed = JSON.parse(docs || '[]');
        const filtered = parsed.filter((doc: any) => doc.id !== id);
        await env.RAG_CACHE.put('documents', JSON.stringify(filtered));

        if (env.QDRANT_URL && env.QDRANT_API_KEY) {
            await this.deleteFromExternalProvider(id);
        }
    }

    private async searchKV(queryEmbedding: number[], topK: number, env: VectorDBEnv): Promise<SearchResult[]> {
        const documents = await env.RAG_CACHE.get('documents', 'text');
        const parsed = JSON.parse(documents || '[]');

        return parsed
            .map((doc: any) => ({ ...doc, score: cosineSimilarity(queryEmbedding, doc.vector) }))
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, topK);
    }

    private async searchExternalProvider(queryEmbedding: number[], options: any): Promise<SearchResult[]> {
        if (!this.fallbackProvider) return [];
        return this.fallbackProvider.search(queryEmbedding, options);
    }

    private async addToExternalProvider(embeddings: any[]): Promise<string[]> {
        if (!this.fallbackProvider) return [];
        return this.fallbackProvider.upsert(embeddings);
    }

    private async deleteFromExternalProvider(id: string): Promise<void> {
        if (!this.fallbackProvider) return;
        await this.fallbackProvider.delete([id]);
    }
}
