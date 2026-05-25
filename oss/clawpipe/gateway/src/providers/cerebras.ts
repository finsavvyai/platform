/** Cerebras provider adapter — OpenAI-compatible, ultra-fast inference. Supports streaming. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const cerebrasAdapter: ProviderAdapter = {
  name: 'cerebras',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });

    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Cerebras ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
