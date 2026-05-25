/**
 * OpenClaw Tool: execute_code — Secure sandbox code execution
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { rateLimit } from '../middleware/rate-limiter';
import { trackSkillExecution } from '../services/openclaw-service';

export const executeCodeRoute = new Hono<{ Bindings: Env }>();

executeCodeRoute.post('/', requireAuthOrApiKey, rateLimit, async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ language: string; code: string }>();

    if (!body.language || !body.code) {
        return c.json({ error: 'language and code are required' }, 400);
    }

    const startTime = Date.now();

    try {
        const pistonLangMap: Record<string, string> = {
            'python': 'python',
            'javascript': 'javascript',
            'node': 'javascript',
        };
        const lang = pistonLangMap[body.language.toLowerCase()] || 'python';
        const versionMap: Record<string, string> = {
            'python': '3.10.0',
            'javascript': '16.3.0',
        };

        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: lang,
                version: versionMap[lang] || '*',
                files: [{ content: body.code }],
            }),
        });

        if (!res.ok) {
            throw new Error(`Sandbox API error: ${await res.text()}`);
        }

        const data: any = await res.json();
        const stdout = data.run?.stdout || '';
        const stderr = data.run?.stderr || '';
        const status = data.run?.code !== 0 ? 'failed' : 'completed';
        const duration = Date.now() - startTime;

        c.executionCtx.waitUntil(
            trackSkillExecution(c.env.DB, {
                userId, skillName: 'execute_code',
                inputLength: body.code.length,
                outputLength: stdout.length + stderr.length,
                durationMs: duration, status, source: 'openclaw-tools',
            }).catch(() => { })
        );

        return c.json({
            tool: 'execute_code', language: lang, stdout, stderr,
            durationMs: duration, exitCode: data.run?.code || 0,
        });
    } catch (err: any) {
        c.executionCtx.waitUntil(
            trackSkillExecution(c.env.DB, {
                userId, skillName: 'execute_code',
                inputLength: body.code.length,
                durationMs: Date.now() - startTime,
                status: 'failed', error: err.message, source: 'openclaw-tools',
            }).catch(() => { })
        );

        return c.json({ error: `Sandbox Execution Failed: ${err.message}` }, 500);
    }
});
