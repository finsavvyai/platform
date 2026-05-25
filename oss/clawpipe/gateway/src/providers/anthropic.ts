/** Anthropic provider adapter. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const anthropicAdapter: ProviderAdapter = {
  name: 'anthropic',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        system: req.system,
        messages: [{ role: 'user', content: req.prompt }],
        temperature: req.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      text: data.content[0]?.text ?? '',
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
