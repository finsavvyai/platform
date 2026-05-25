/** Azure OpenAI provider adapter — custom deployment URLs. Supports streaming. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const azureOpenaiAdapter: ProviderAdapter = {
  name: 'azure-openai',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    // apiKey format: "https://<resource>.openai.azure.com|<api-version>|<key>"
    const parts = apiKey.split('|');
    if (parts.length !== 3) throw new Error('Azure OpenAI: expected ENDPOINT|API_VERSION|KEY');
    const [endpoint, apiVersion, key] = parts;

    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });

    const url = `${endpoint}/openai/deployments/${req.model}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({
        messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Azure OpenAI ${res.status}: ${body.slice(0, 200)}`);
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
