/**
 * OpenClaw Tool: luna_index — Index files for RAG
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { trackSkillExecution } from '../services/openclaw-service';
import { chunkText } from '../services/llm-streaming';

export const indexToolRoute = new Hono<{ Bindings: Env }>();

indexToolRoute.post('/', requireAuthOrApiKey, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
        files: Array<{ path: string; content: string; type?: string }>;
        repoName?: string;
    }>();

    if (!body.files || body.files.length === 0) {
        return c.json({ error: 'files array is required and must not be empty' }, 400);
    }

    const startTime = Date.now();

    try {
        if (!c.env.AI || !c.env.VECTORIZE) {
            return c.json({
                error: 'RAG not configured',
                hint: 'Vectorize and AI bindings are required for indexing',
            }, 503);
        }

        let indexed = 0;
        let failed = 0;

        for (const file of body.files) {
            try {
                const chunks = chunkText(file.content, 512, 50);

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const chunkId = `${file.path}:${i}`;

                    const embeddingResult = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
                        text: [chunk],
                    });

                    const vector = embeddingResult?.data?.[0];
                    if (!vector || vector.length === 0) continue;

                    await c.env.VECTORIZE.insert([{
                        id: chunkId,
                        values: vector,
                        metadata: { source: file.path, repo: body.repoName, chunkIndex: i },
                    }]);

                    await c.env.DB.prepare(`
                        INSERT OR REPLACE INTO chunks (id, content, metadata)
                        VALUES (?, ?, ?)
                    `).bind(
                        chunkId,
                        chunk,
                        JSON.stringify({
                            source: file.path, path: file.path,
                            repo: body.repoName, language: file.type, chunkIndex: i,
                        }),
                    ).run();
                }

                indexed++;
            } catch {
                failed++;
            }
        }

        const duration = Date.now() - startTime;

        try {
            await trackSkillExecution(c.env.DB, {
                userId, skillName: 'luna_index',
                inputLength: body.files.reduce((sum, f) => sum + f.content.length, 0),
                durationMs: duration,
                status: failed === body.files.length ? 'failed' : 'completed',
                source: 'openclaw-tools',
            });
        } catch { /* non-critical */ }

        return c.json({
            tool: 'luna_index', indexed, failed,
            total: body.files.length, repoName: body.repoName, durationMs: duration,
        });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});
