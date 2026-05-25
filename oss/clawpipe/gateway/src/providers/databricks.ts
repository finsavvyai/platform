/** Databricks Serving provider adapter — workspace-specific URL via DATABRICKS_HOST env. */

import type { PromptRequest, PromptResponse, ProviderAdapter } from '../types';

export const databricksAdapter: ProviderAdapter = {
  name: 'databricks',

  async call(req: PromptRequest, apiKey: string): Promise<PromptResponse> {
    const start = Date.now();
    // apiKey format: "https://workspace.cloud.databricks.com|<token>"
    const [host, token] = apiKey.includes('|') ? apiKey.split('|') : ['', apiKey];
    if (!host) throw new Error('Databricks: missing workspace host (expected HOST|TOKEN)');

    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });

    const res = await fetch(`${host}/serving-endpoints/${req.model}/invocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Databricks ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      text: data.choices[0]?.message?.content ?? '',
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  },
};
