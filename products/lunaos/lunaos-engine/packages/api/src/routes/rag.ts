import { Hono } from 'hono';
import { RawDocument, DocumentType } from '@lunaos/rag';
import { Env } from '../worker';
import { validateJson, validateQuery } from '../middleware/validation';
import { requireAuth } from '../middleware/auth';
import { ragIndexSchema, ragSearchQuerySchema, ragMemorySchema, ragMemorySearchSchema, ragAnalyticsQuerySchema } from '../schemas';
import { getRAGEngine, getSearchAnalytics } from '../utils/rag-factory';
import { getDocumentType } from '../utils/document-type';
import { hybridSearch, indexForSparseSearch } from '../services/hybrid-search';

export const ragRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /index
 * Index files from a repository or local upload
 */
ragRoutes.post('/index', requireAuth, validateJson(ragIndexSchema), async (c) => {
    try {
        const { files, repoName } = c.req.valid('json');

        const ragEngine = await getRAGEngine(c.env);

        const documents: RawDocument[] = files.map(file => ({
            id: `${repoName ? repoName + '/' : ''}${file.path}`,
            content: file.content,
            source: repoName || 'upload',
            title: file.path,
            type: (file.type as DocumentType) || getDocumentType(file.path),
            metadata: {
                path: file.path,
                repo: repoName,
                extension: file.path.split('.').pop()
            }
        }));

        const result = await ragEngine.ingestDocuments(documents);

        // Also index into FTS5 for sparse/hybrid search
        for (const doc of documents) {
            await indexForSparseSearch(
                c.env.DB, doc.id, doc.content,
                doc.source, doc.metadata?.path ?? doc.title,
            );
        }

        return c.json({
            success: true,
            indexed: result.processedDocuments,
            failed: result.failedDocuments,
            errors: result.errors,
            processingTime: result.processingTime,
        });
    } catch (error: any) {
        return c.json({ error: 'Indexing failed', details: error.message }, 500);
    }
});

/**
 * GET /search
 * Hybrid search (dense + sparse) across indexed codebase
 */
ragRoutes.get('/search', requireAuth, validateQuery(ragSearchQuerySchema), async (c) => {
    try {
        const { q: query } = c.req.valid('query');
        const mode = c.req.query('mode') || 'hybrid';

        // Pure dense search (legacy behavior)
        if (mode === 'dense') {
            const ragEngine = await getRAGEngine(c.env);
            const response = await ragEngine.query({ query });
            return c.json({
                query: response.query,
                answer: response.answer,
                sources: response.sources.map(s => ({
                    path: s.metadata?.path || s.document.id,
                    content: s.document.content,
                    score: s.score,
                    repo: s.metadata?.repo,
                })),
                confidence: response.confidence,
                mode: 'dense',
            });
        }

        // Hybrid search: dense (Vectorize) + sparse (FTS5) with RRF
        const results = await hybridSearch(c.env, query, 10);
        return c.json({
            query,
            results: results.map(r => ({
                id: r.id,
                content: r.text,
                score: r.score,
                source: r.source,
                metadata: r.metadata,
            })),
            total: results.length,
            mode: 'hybrid',
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ error: 'Search failed', details: message }, 500);
    }
});

/**
 * POST /memories
 * Store a persistent memory for an agent
 */
ragRoutes.post('/memories', requireAuth, validateJson(ragMemorySchema), async (c) => {
    try {
        const { agentId, content, metadata } = c.req.valid('json');
        const ragEngine = await getRAGEngine(c.env);

        // Store memory as a document with DocumentType.TEXT and specific metadata
        const memoryId = `memory-${agentId}-${crypto.randomUUID()}`;
        const documents: RawDocument[] = [{
            id: memoryId,
            content,
            source: 'agent_memory',
            title: `Memory for ${agentId}`,
            type: DocumentType.TEXT,
            metadata: {
                ...metadata,
                agentId,
                isMemory: true,
                timestamp: new Date().toISOString()
            }
        }];

        const result = await ragEngine.ingestDocuments(documents);

        return c.json({
            success: true,
            memoryId,
            indexed: result.processedDocuments
        });
    } catch (error: any) {
        return c.json({ error: 'Memory storage failed', details: error.message }, 500);
    }
});

/**
 * GET /memories
 * Retrieve relevant memories using semantic search
 */
ragRoutes.get('/memories', requireAuth, validateQuery(ragMemorySearchSchema), async (c) => {
    try {
        const { q: query, agentId, topK } = c.req.valid('query');
        const ragEngine = await getRAGEngine(c.env);

        const response = await ragEngine.query({ query });

        const sources = response.sources
            .filter(s => s.metadata?.isMemory === true && (!agentId || s.metadata?.agentId === agentId))
            .map(s => ({
                id: s.document.id,
                content: s.document.content,
                score: s.score,
                metadata: s.metadata
            }))
            .slice(0, topK);

        return c.json({ memories: sources });
    } catch (error: any) {
        return c.json({ error: 'Memory retrieval failed', details: error.message }, 500);
    }
});

/**
 * GET /analytics
 * Search performance statistics
 */
ragRoutes.get('/analytics', requireAuth, async (c) => {
    try {
        const analytics = getSearchAnalytics(c.env);
        const stats = await analytics.getPerformanceStats();
        return c.json(stats);
    } catch (error: any) {
        return c.json({ error: 'Analytics failed', details: error.message }, 500);
    }
});

/**
 * GET /analytics/queries
 * Top search queries
 */
ragRoutes.get('/analytics/queries', requireAuth, validateQuery(ragAnalyticsQuerySchema), async (c) => {
    try {
        const { limit } = c.req.valid('query');
        const analytics = getSearchAnalytics(c.env);
        const queries = await analytics.getTopQueries(limit);
        return c.json({ queries });
    } catch (error: any) {
        return c.json({ error: 'Analytics queries failed', details: error.message }, 500);
    }
});
