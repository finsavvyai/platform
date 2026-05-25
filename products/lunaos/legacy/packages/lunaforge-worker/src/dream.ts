
export interface DreamJob {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    intent: any;
    result?: any;
    createdAt: number;
}

import { LLMProvider, OpenAIProvider, MockProvider } from './llm';

// Define minimal KVNamespace type for environment
interface KVNamespace {
    get(key: string, options?: { type: 'json' }): Promise<any>;
    put(key: string, value: string): Promise<void>;
}

export interface Env {
    LUNAFORGE_KV?: KVNamespace;
    OPENAI_API_KEY?: string;
}

export class DreamService {
    // Stateless service - no internal map!

    constructor() { }

    // Pass 'env' so we can access API keys and KV
    async scheduleJob(intent: any, env: any, ctx?: any): Promise<{ jobId: string }> {
        const jobId = Math.random().toString(36).substring(7);
        const job: DreamJob = {
            id: jobId,
            status: 'pending',
            intent,
            createdAt: Date.now()
        };

        // Persist initial state
        if (env.LUNAFORGE_KV) {
            await env.LUNAFORGE_KV.put(`job:${jobId}`, JSON.stringify(job));
        } else {
            console.warn('LUNAFORGE_KV not bound. Job will be lost if worker recycles.');
            // Fallback to memory map logic is removed as we aim for persistence.
            // In dev without KV binding, this might fail or be silent.
            // Assumption: User uses 'wrangler dev' which supplies local KV.
        }

        // Trigger processing
        const task = this.processJob(jobId, env);
        if (ctx && ctx.waitUntil) {
            ctx.waitUntil(task);
        } else {
            task.catch(console.error);
        }

        return { jobId };
    }

    async getJobStatus(jobId: string, env: any): Promise<DreamJob | null> {
        if (!env.LUNAFORGE_KV) return null;
        try {
            return await env.LUNAFORGE_KV.get(`job:${jobId}`, { type: 'json' });
        } catch (e) {
            console.error('KV Get Error:', e);
            return null;
        }
    }

    private async processJob(jobId: string, env: any) {
        if (!env.LUNAFORGE_KV) return;

        let job: DreamJob | null = await env.LUNAFORGE_KV.get(`job:${jobId}`, { type: 'json' });
        if (!job) return;

        job.status = 'processing';
        await env.LUNAFORGE_KV.put(`job:${jobId}`, JSON.stringify(job));

        try {
            // Select Provider
            let provider: LLMProvider;
            if (env && env.OPENAI_API_KEY) {
                provider = new OpenAIProvider(env.OPENAI_API_KEY);
            } else {
                console.log('No API key found in env, using MockProvider');
                provider = new MockProvider();
            }

            // Construct System Prompt
            const systemPrompt = `You are LunaForge Dream, an advanced AI architect.
Your goal is to analyze the user's request and provide a high-level plan or code solution.
Output format: JSON with fields 'summary' (string) and 'files' (array of {path, content}).
Ensure your response is valid JSON only, no markdown fencing.`;

            // Call LLM
            const response = await provider.complete([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: JSON.stringify(job.intent) }
            ]);

            // Parse Result
            let resultData;
            try {
                let cleanContent = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
                resultData = JSON.parse(cleanContent);
            } catch (e) {
                resultData = {
                    summary: response.content,
                    files: []
                };
            }

            job.result = resultData;
            job.status = 'completed';

        } catch (error) {
            console.error('Dream processing failed:', error);
            job.status = 'failed';
            job.result = { error: String(error) };
        }

        // Save final state
        await env.LUNAFORGE_KV.put(`job:${jobId}`, JSON.stringify(job));
    }
}
