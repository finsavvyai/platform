/** Google Gemini provider adapter (generativelanguage v1beta). */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const geminiAdapter: ProviderAdapter = {
  name: 'gemini',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    const model = encodeURIComponent(req.model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      },
    };
    if (req.system) {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('') ?? '';

    return {
      text,
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
