/** HuggingFace Inference API provider adapter. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const huggingfaceAdapter: ProviderAdapter = {
  name: 'huggingface',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    const inputs = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;

    const res = await fetch(`https://api-inference.huggingface.co/models/${req.model}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs,
        parameters: {
          max_new_tokens: req.maxTokens ?? 4096,
          temperature: req.temperature ?? 0.7,
          return_full_text: false,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HuggingFace ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as
      | Array<{ generated_text: string }>
      | { generated_text: string };

    const text = Array.isArray(data) ? (data[0]?.generated_text ?? '') : (data.generated_text ?? '');
    // HF inference API does not return token usage; estimate from char count.
    const tokensIn = Math.ceil(inputs.length / 4);
    const tokensOut = Math.ceil(text.length / 4);

    return { text, tokensIn, tokensOut, latencyMs: Date.now() - start };
  },
};
