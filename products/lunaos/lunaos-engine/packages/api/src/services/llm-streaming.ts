/**
 * LLM Streaming Helpers — shared by openclaw-tools and other streaming routes.
 * Routes through Claw Gateway when configured.
 */

import { callViaGatewayStream, isGatewayConfigured, type ClawEnv } from './claw-gateway';
import { redactPII } from './pii-redactor';

/**
 * Call an LLM provider in streaming mode.
 * Returns the raw Response (SSE stream) from the provider.
 */
export async function callLLM(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    env?: ClawEnv,
): Promise<Response> {
    const safeSystemPrompt = redactPII(systemPrompt);
    const safeUserMessage = redactPII(userMessage);
    const guardedMessage = `[USER_INPUT_START]\n${safeUserMessage}\n[USER_INPUT_END]`;

    // Route through Claw Gateway if configured
    if (env && isGatewayConfigured(env)) {
        return callViaGatewayStream(env, safeSystemPrompt, guardedMessage, provider, model);
    }

    if (provider === 'anthropic') {
        return fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 8192,
                temperature: 0.3,
                system: safeSystemPrompt,
                messages: [{ role: 'user', content: guardedMessage }],
                stream: true,
            }),
        });
    }

    const baseUrls: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions',
    };
    const url = baseUrls[provider] || baseUrls.openai;

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 8192,
            temperature: 0.3,
            messages: [
                { role: 'system', content: safeSystemPrompt },
                { role: 'user', content: guardedMessage },
            ],
            stream: true,
        }),
    });
}

/**
 * Parse a streaming SSE token from a provider's response chunk.
 */
export function parseSSEToken(data: string, provider: string): string {
    try {
        const parsed = JSON.parse(data);
        if (provider === 'anthropic') {
            if (parsed.type === 'content_block_delta') {
                return parsed.delta?.text || '';
            }
            return '';
        }
        return parsed.choices?.[0]?.delta?.content || '';
    } catch {
        return '';
    }
}

/**
 * Split text into overlapping chunks for embedding / indexing.
 */
export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
        if (start >= text.length) break;
    }

    return chunks;
}

/**
 * Resolve LLM provider config (API key + default model).
 */
export function resolveLLMConfig(
    env: { ANTHROPIC_API_KEY?: string; OPENAI_API_KEY?: string; DEEPSEEK_API_KEY?: string },
    provider?: string,
    model?: string,
): { provider: string; model: string; apiKey: string | undefined } {
    const selectedProvider = provider || 'deepseek';
    const defaultModels: Record<string, string> = {
        anthropic: 'claude-sonnet-4-20250514',
        openai: 'gpt-4o',
        deepseek: 'deepseek-chat',
    };
    const selectedModel = model || defaultModels[selectedProvider] || 'deepseek-chat';

    const apiKeyMap: Record<string, string | undefined> = {
        anthropic: env.ANTHROPIC_API_KEY,
        openai: env.OPENAI_API_KEY,
        deepseek: env.DEEPSEEK_API_KEY,
    };

    return {
        provider: selectedProvider,
        model: selectedModel,
        apiKey: apiKeyMap[selectedProvider],
    };
}
