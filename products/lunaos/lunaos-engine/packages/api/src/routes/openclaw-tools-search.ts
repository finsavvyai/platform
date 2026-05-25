/**
 * OpenClaw Tool: luna_search — Semantic RAG search
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { trackSkillExecution } from '../services/openclaw-service';

export const searchToolRoute = new Hono<{ Bindings: Env }>();

searchToolRoute.post('/', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ query: string; topK?: number }>();

    if (!body.query) {
        return c.json({ error: 'query is required' }, 400);
    }

    const startTime = Date.now();

    try {
        if (!c.env.AI || !c.env.VECTORIZE) {
            return c.json({
                error: 'RAG not configured',
                hint: 'Vectorize and AI bindings are required for semantic search',
            }, 503);
        }

        const topK = body.topK || 5;

        const embeddingResult = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [body.query.substring(0, 512)],
        });

        const queryVector = embeddingResult?.data?.[0];
        if (!queryVector || queryVector.length === 0) {
            return c.json({ error: 'Failed to generate query embedding' }, 500);
        }

        const searchResult = await c.env.VECTORIZE.query(queryVector, {
            topK, returnValues: false, returnMetadata: true,
        });

        const sources: any[] = [];
        if (searchResult?.matches?.length > 0) {
            const chunkIds = searchResult.matches.map((m: any) => `'${m.id}'`).join(',');
            const chunks = await c.env.DB.prepare(
                `SELECT id, content, metadata FROM chunks WHERE id IN (${chunkIds})`
            ).all();

            const contentMap = new Map<string, any>();
            (chunks.results || []).forEach((row: any) => contentMap.set(row.id, row));

            for (const match of searchResult.matches) {
                const row = contentMap.get(match.id);
                if (!row?.content) continue;
                let meta: any = {};
                try { meta = JSON.parse(row.metadata || '{}'); } catch { /* ok */ }
                sources.push({
                    path: meta?.source || meta?.path || match.id,
                    score: match.score,
                    content: row.content.substring(0, 500),
                    language: meta?.language,
                });
            }
        }

        const duration = Date.now() - startTime;

        try {
            await trackSkillExecution(c.env.DB, {
                userId, skillName: 'luna_search',
                inputLength: body.query.length,
                outputLength: JSON.stringify(sources).length,
                durationMs: duration, status: 'completed', source: 'openclaw-tools',
            });
        } catch { /* non-critical */ }

        return c.json({
            tool: 'luna_search', query: body.query, sources,
            count: sources.length, searchTimeMs: duration,
            confidence: sources.length > 0 ? sources[0].score : 0,
        });
    } catch (err: any) {
        try {
            await trackSkillExecution(c.env.DB, {
                userId, skillName: 'luna_search',
                inputLength: body.query.length,
                durationMs: Date.now() - startTime,
                status: 'failed', error: err.message, source: 'openclaw-tools',
            });
        } catch { /* ignore */ }
        return c.json({ error: err.message }, 500);
    }
});
