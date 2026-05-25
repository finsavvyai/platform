/** Cohere provider adapter — custom chat format. Supports streaming. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const cohereAdapter: ProviderAdapter = {
  name: 'cohere',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();

    const res = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        message: req.prompt,
        preamble: req.system,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Cohere ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      text: string;
      meta?: { billed_units?: { input_tokens?: number; output_tokens?: number } };
    };

    return {
      text: data.text ?? '',
      tokensIn: data.meta?.billed_units?.input_tokens ?? 0,
      tokensOut: data.meta?.billed_units?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
