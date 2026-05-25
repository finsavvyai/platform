/**
 * Chain LLM — synchronous (non-streaming) LLM call for chain node execution.
 * Routes through Claw Gateway when configured.
 */

import { callViaGatewaySync, isGatewayConfigured, type ClawEnv } from './claw-gateway';

/**
 * Call an LLM provider synchronously (returns full text, no streaming).
 */
export async function callLLMSync(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 4096,
    temperature?: number,
    env?: ClawEnv,
): Promise<string> {
    // Route through Claw Gateway if configured
    if (env && isGatewayConfigured(env)) {
        return callViaGatewaySync(env, systemPrompt, userMessage, provider, model, maxTokens);
    }

    let response: Response;

    if (provider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                temperature: temperature ?? 0.3,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Anthropic API error ${response.status}: ${errBody.substring(0, 200)}`);
        }

        const data = await response.json() as any;
        return data.content?.[0]?.text || '';
    }

    // OpenAI-compatible (OpenAI, DeepSeek, etc.)
    const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
    };
    const url = baseUrls[provider] || baseUrls.openai;

    response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: temperature ?? 0.3,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`${provider} API error ${response.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
}
