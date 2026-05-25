/**
 * LLM Client — supports multiple providers with streaming
 *
 * Supported providers:
 *   - Anthropic (Claude)
 *   - OpenAI (GPT-4o)
 *   - DeepSeek
 *   - xAI (Grok)
 *   - Google (Gemini) — via OpenAI-compatible endpoint
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';

export type Provider =
    | 'anthropic' | 'openai' | 'deepseek' | 'xai' | 'google'
    | 'mistral' | 'cohere' | 'perplexity' | 'together' | 'groq'
    | 'fireworks' | 'openrouter';

export interface ProviderInfo {
    name: string;
    envVar: string;
    defaultModel: string;
    baseUrl: string;
    apiStyle: 'anthropic' | 'openai-compat';
    signupUrl: string;
    keyGuide: string;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
    anthropic: {
        name: 'Anthropic (Claude)',
        envVar: 'ANTHROPIC_API_KEY',
        defaultModel: 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.anthropic.com',
        apiStyle: 'anthropic',
        signupUrl: 'https://console.anthropic.com',
        keyGuide: '1. Go to console.anthropic.com\n  2. Sign up / Log in\n  3. Go to API Keys → Create Key\n  4. Copy the key (starts with sk-ant-...)',
    },
    openai: {
        name: 'OpenAI (GPT-4o)',
        envVar: 'OPENAI_API_KEY',
        defaultModel: 'gpt-4o',
        baseUrl: 'https://api.openai.com',
        apiStyle: 'openai-compat',
        signupUrl: 'https://platform.openai.com/api-keys',
        keyGuide: '1. Go to platform.openai.com/api-keys\n  2. Sign up / Log in\n  3. Click "Create new secret key"\n  4. Copy the key (starts with sk-...)',
    },
    deepseek: {
        name: 'DeepSeek',
        envVar: 'DEEPSEEK_API_KEY',
        defaultModel: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        apiStyle: 'openai-compat',
        signupUrl: 'https://platform.deepseek.com/api_keys',
        keyGuide: '1. Go to platform.deepseek.com\n  2. Sign up / Log in\n  3. Go to API Keys page\n  4. Create and copy your key (starts with sk-...)',
    },
    xai: {
        name: 'xAI (Grok)',
        envVar: 'XAI_API_KEY',
        defaultModel: 'grok-3',
        baseUrl: 'https://api.x.ai',
        apiStyle: 'openai-compat',
        signupUrl: 'https://console.x.ai',
        keyGuide: '1. Go to console.x.ai\n  2. Sign up / Log in\n  3. Go to API Keys\n  4. Create and copy your key',
    },
    google: {
        name: 'Google (Gemini)',
        envVar: 'GOOGLE_API_KEY',
        defaultModel: 'gemini-2.0-flash',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiStyle: 'openai-compat',
        signupUrl: 'https://aistudio.google.com/apikey',
        keyGuide: '1. Go to aistudio.google.com/apikey\n  2. Sign in with Google\n  3. Click "Create API Key"\n  4. Copy the key',
    },
    mistral: {
        name: 'Mistral AI',
        envVar: 'MISTRAL_API_KEY',
        defaultModel: 'mistral-large-latest',
        baseUrl: 'https://api.mistral.ai',
        apiStyle: 'openai-compat',
        signupUrl: 'https://console.mistral.ai/api-keys',
        keyGuide: '1. Go to console.mistral.ai\n  2. Sign up / Log in\n  3. Go to API Keys\n  4. Create and copy your key',
    },
    cohere: {
        name: 'Cohere (Command R+)',
        envVar: 'COHERE_API_KEY',
        defaultModel: 'command-r-plus',
        baseUrl: 'https://api.cohere.com/compatibility',
        apiStyle: 'openai-compat',
        signupUrl: 'https://dashboard.cohere.com/api-keys',
        keyGuide: '1. Go to dashboard.cohere.com\n  2. Sign up / Log in\n  3. Go to API Keys\n  4. Create and copy your key',
    },
    perplexity: {
        name: 'Perplexity (Sonar)',
        envVar: 'PERPLEXITY_API_KEY',
        defaultModel: 'sonar-pro',
        baseUrl: 'https://api.perplexity.ai',
        apiStyle: 'openai-compat',
        signupUrl: 'https://www.perplexity.ai/settings/api',
        keyGuide: '1. Go to perplexity.ai/settings/api\n  2. Sign up / Log in\n  3. Generate API Key\n  4. Copy the key (starts with pplx-...)',
    },
    together: {
        name: 'Together AI',
        envVar: 'TOGETHER_API_KEY',
        defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        baseUrl: 'https://api.together.xyz',
        apiStyle: 'openai-compat',
        signupUrl: 'https://api.together.ai/settings/api-keys',
        keyGuide: '1. Go to api.together.ai\n  2. Sign up / Log in\n  3. Go to Settings → API Keys\n  4. Create and copy your key',
    },
    groq: {
        name: 'Groq (Fast Inference)',
        envVar: 'GROQ_API_KEY',
        defaultModel: 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai',
        apiStyle: 'openai-compat',
        signupUrl: 'https://console.groq.com/keys',
        keyGuide: '1. Go to console.groq.com\n  2. Sign up / Log in\n  3. Go to API Keys\n  4. Create and copy your key (starts with gsk_...)',
    },
    fireworks: {
        name: 'Fireworks AI',
        envVar: 'FIREWORKS_API_KEY',
        defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        baseUrl: 'https://api.fireworks.ai/inference',
        apiStyle: 'openai-compat',
        signupUrl: 'https://fireworks.ai/account/api-keys',
        keyGuide: '1. Go to fireworks.ai\n  2. Sign up / Log in\n  3. Go to Account → API Keys\n  4. Create and copy your key',
    },
    openrouter: {
        name: 'OpenRouter (Multi-Model)',
        envVar: 'OPENROUTER_API_KEY',
        defaultModel: 'anthropic/claude-sonnet-4-20250514',
        baseUrl: 'https://openrouter.ai/api',
        apiStyle: 'openai-compat',
        signupUrl: 'https://openrouter.ai/keys',
        keyGuide: '1. Go to openrouter.ai/keys\n  2. Sign up / Log in\n  3. Create API Key\n  4. Copy the key (starts with sk-or-...)\n  5. Access 200+ models from all providers!',
    },
};

export interface LLMConfig {
    provider: Provider;
    model: string;
    apiKey: string;
    maxTokens?: number;
    temperature?: number;
}

export interface StreamCallbacks {
    onToken: (token: string) => void;
    onDone: (fullText: string) => void;
    onError: (error: Error) => void;
}

/**
 * Call LLM with streaming response
 */
export async function streamLLM(
    config: LLMConfig,
    systemPrompt: string,
    userMessage: string,
    callbacks: StreamCallbacks
): Promise<string> {
    const providerInfo = PROVIDERS[config.provider];

    if (providerInfo.apiStyle === 'anthropic') {
        return streamAnthropic(config, systemPrompt, userMessage, callbacks);
    } else {
        return streamOpenAICompat(config, providerInfo, systemPrompt, userMessage, callbacks);
    }
}

async function streamAnthropic(
    config: LLMConfig,
    systemPrompt: string,
    userMessage: string,
    callbacks: StreamCallbacks
): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens || 8192,
            temperature: config.temperature ?? 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            stream: true,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${body}`);
    }

    return processSSEStream(response, callbacks, 'anthropic');
}

/**
 * OpenAI-compatible streaming — works with OpenAI, DeepSeek, xAI, Google
 */
async function streamOpenAICompat(
    config: LLMConfig,
    providerInfo: ProviderInfo,
    systemPrompt: string,
    userMessage: string,
    callbacks: StreamCallbacks
): Promise<string> {
    const url = `${providerInfo.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens || 8192,
            temperature: config.temperature ?? 0.3,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            stream: true,
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`${providerInfo.name} API error (${response.status}): ${body}`);
    }

    return processSSEStream(response, callbacks, 'openai');
}

async function processSSEStream(
    response: Response,
    callbacks: StreamCallbacks,
    format: 'anthropic' | 'openai'
): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    let token = '';

                    if (format === 'anthropic') {
                        if (parsed.type === 'content_block_delta') {
                            token = parsed.delta?.text || '';
                        }
                    } else {
                        token = parsed.choices?.[0]?.delta?.content || '';
                    }

                    if (token) {
                        fullText += token;
                        callbacks.onToken(token);
                    }
                } catch { /* skip unparseable lines */ }
            }
        }

        callbacks.onDone(fullText);
        return fullText;
    } catch (error) {
        callbacks.onError(error as Error);
        throw error;
    }
}

/**
 * Resolve API key from: 1) env vars, 2) ~/.luna/credentials.yaml
 */
export function resolveApiKey(provider: Provider): string | null {
    const info = PROVIDERS[provider];
    if (!info) return null;

    // 1. Check env vars first
    if (process.env[info.envVar]) return process.env[info.envVar]!;

    // 2. Check saved credentials
    try {
        const credPath = path.join(os.homedir(), '.luna', 'credentials.yaml');
        if (fs.existsSync(credPath)) {
            const creds = yaml.parse(fs.readFileSync(credPath, 'utf-8'));
            if (creds?.[info.envVar]) return creds[info.envVar];
        }
    } catch { /* ignore */ }

    return null;
}

/**
 * Get default model for provider
 */
export function defaultModel(provider: Provider): string {
    return PROVIDERS[provider]?.defaultModel || 'gpt-4o';
}
