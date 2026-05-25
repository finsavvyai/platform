/** Replicate provider adapter — prediction format (sync with wait). */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const replicateAdapter: ProviderAdapter = {
  name: 'replicate',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.7,
    };
    if (req.system) input.system_prompt = req.system;

    const res = await fetch(`https://api.replicate.com/v1/models/${req.model}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Prefer': 'wait=60',
      },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Replicate ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      output?: string | string[];
      metrics?: { input_token_count?: number; output_token_count?: number };
    };

    const text = Array.isArray(data.output) ? data.output.join('') : (data.output ?? '');
    return {
      text,
      tokensIn: data.metrics?.input_token_count ?? 0,
      tokensOut: data.metrics?.output_token_count ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
