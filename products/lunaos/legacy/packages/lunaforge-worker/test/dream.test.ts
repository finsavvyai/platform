import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DreamService, Env, DreamJob } from '../src/dream';

// Mock KV
class MockKV {
    store = new Map<string, string>();
    async get(key: string, options?: { type: 'json' }) {
        const val = this.store.get(key);
        if (!val) return null;
        if (options?.type === 'json') return JSON.parse(val);
        return val;
    }
    async put(key: string, value: string) {
        this.store.set(key, value);
    }
}

describe('DreamService', () => {
    let service: DreamService;
    let env: Env;
    let kv: MockKV;

    beforeEach(() => {
        kv = new MockKV();
        env = {
            LUNAFORGE_KV: kv as any
        };
        service = new DreamService();
    });

    it('schedules a job and persists pending state', async () => {
        const intent = { prompt: "test prompt" };
        const { jobId } = await service.scheduleJob(intent, env);

        expect(jobId).toBeDefined();

        // Verify persisted state
        const job = await service.getJobStatus(jobId, env);
        expect(job).toBeDefined();
        expect(['pending', 'processing']).toContain(job?.status); // 'processing' is fine if worker is fast
        expect(job?.intent).toEqual(intent);
    });

    it('processes job successfully (Mock Provider)', async () => {
        const intent = { prompt: "test prompt" };

        // Mock setTimeout to speed up test? 
        // Or actually the MockProvider has a delay?
        // Wait, scheduleJob triggers processJob asynchronously (no dependency on await).
        // But in test environment, without ctx.waitUntil, the promise is unhandled unless we await it?
        // Ah, `processJob` IS awaited in `scheduleJob` if `ctx` is missing?
        // No, `task.catch(console.error)` is called. It runs in background.

        // To test async result, we need to wait a bit.
        const { jobId } = await service.scheduleJob(intent, env);

        // Wait for "mock processing" (MockProvider has 2s delay)
        // We can advance timers or just sleep.
        await new Promise(r => setTimeout(r, 2500));

        const job = await service.getJobStatus(jobId, env);
        expect(job?.status).toBe('completed');
        expect(job?.result).toBeDefined();
        expect(job?.result.files).toBeDefined();
    });

    it('uses OpenAI Key if provided', async () => {
        env.OPENAI_API_KEY = "sk-mock-key";
        // We need to mock fetch global for OpenAIProvider
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({ summary: "AI Summary", files: [] }) } }],
                usage: { prompt_tokens: 1, completion_tokens: 1 }
            })
        } as any);

        const { jobId } = await service.scheduleJob({ prompt: "real ai" }, env);

        // Wait for async process (OpenAI provider doesn't have artificial delay, but `await fetch` takes tick)
        await new Promise(r => setTimeout(r, 100));

        const job = await service.getJobStatus(jobId, env);
        expect(job?.status).toBe('completed');
        expect(fetch).toHaveBeenCalled();
    });
});
