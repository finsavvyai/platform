import { Hono } from 'hono';
import { RawDocument, DocumentType } from '@lunaos/rag';
import { Env } from '../worker';
import { validateJson } from '../middleware/validation';
import { requireAuth } from '../middleware/auth';
import { kbUploadSchema } from '../schemas';
import { getRAGEngine } from '../utils/rag-factory';

export const kbRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /kb
 * List knowledge base documents
 */
kbRoutes.get('/', requireAuth, async (c) => {
    try {
        // Return KB docs from D1 documents table 
        // using the rag schema's documents table format
        const results = await c.env.DB.prepare(
            "SELECT id, path as title, created_at FROM documents WHERE path LIKE 'kb/%' ORDER BY created_at DESC"
        ).all();

        return c.json({ documents: results.results || [] });
    } catch (error: any) {
        return c.json({ error: 'Failed to fetch KB docs', details: error.message }, 500);
    }
});

/**
 * POST /kb/upload
 * Upload a document to the global enterprise KB
 */
kbRoutes.post('/upload', requireAuth, validateJson(kbUploadSchema), async (c) => {
    try {
        const { title, content, tags } = c.req.valid('json');
        const ragEngine = await getRAGEngine(c.env);

        const docId = `kb-${crypto.randomUUID()}`;
        const pathStr = `kb/${title}`;

        const documents: RawDocument[] = [{
            id: docId,
            content,
            source: 'upload',
            title,
            type: DocumentType.MARKDOWN,
            metadata: {
                isKB: true,
                tags: tags || []
            }
        }];

        const result = await ragEngine.ingestDocuments(documents);

        return c.json({
            success: true,
            id: docId,
            indexed: result.processedDocuments
        });
    } catch (error: any) {
        console.error('KB upload failed:', error);
        return c.json({ error: 'Upload failed', details: error.message }, 500);
    }
});

/**
 * DELETE /kb/:id
 * Delete a KB document. Enterprise tier only (shared KB).
 * Restricted to kb/* documents — refuses to touch non-KB docs.
 */
kbRoutes.delete('/:id', requireAuth, async (c) => {
    const tier = c.get('userTier');
    if (tier !== 'enterprise') {
        return c.json({ error: 'Forbidden: KB delete requires enterprise tier' }, 403);
    }

    const id = c.req.param('id');
    try {
        const res = await c.env.DB.prepare(
            "DELETE FROM documents WHERE id = ? AND path LIKE 'kb/%'",
        ).bind(id).run();
        if (!res.meta || (res.meta as { changes?: number }).changes === 0) {
            return c.json({ error: 'KB document not found' }, 404);
        }
        return c.json({ success: true });
    } catch (error: any) {
        return c.json({ error: 'Delete failed', details: error.message }, 500);
    }
});
