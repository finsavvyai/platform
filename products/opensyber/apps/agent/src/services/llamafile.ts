/**
 * llamafile Local AI Client
 *
 * Provides offline LLM inference via llamafile (Mozilla).
 * llamafile bundles a model as a single executable with an
 * OpenAI-compatible API at localhost:8080.
 *
 * Used as fallback when Claw Gateway is unreachable (air-gapped,
 * network failure). Supports basic triage and security analysis.
 */

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8080';
const DEFAULT_TIMEOUT_MS = 30_000;
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface LlamafileConfig {
  endpoint?: string;
  timeoutMs?: number;
}

function validateEndpoint(endpoint: string): void {
  const url = new URL(endpoint);
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error('llamafile endpoint must be localhost');
  }
}

export interface LlamafileResponse {
  text: string;
  model: string;
  tokensUsed: number;
}

/**
 * Check if a llamafile server is running locally.
 */
export async function isLlamafileAvailable(
  config: LlamafileConfig = {},
): Promise<boolean> {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  validateEndpoint(endpoint);
  try {
    const res = await fetch(`${endpoint}/v1/models`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a completion request to the local llamafile server.
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 */
export async function llamafileComplete(
  prompt: string,
  config: LlamafileConfig = {},
): Promise<LlamafileResponse> {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  validateEndpoint(endpoint);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`llamafile error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { total_tokens: number };
  };

  return {
    text: data.choices[0]?.message?.content ?? '',
    model: data.model ?? 'unknown',
    tokensUsed: data.usage?.total_tokens ?? 0,
  };
}

/**
 * Run a basic security triage locally when gateway is unavailable.
 */
export async function localTriage(
  finding: { title: string; description: string; severity: string },
  config: LlamafileConfig = {},
): Promise<{ assessment: string; suggestedPriority: string }> {
  const prompt = [
    'You are a security analyst. Assess this security finding:',
    `Title: ${finding.title}`,
    `Description: ${finding.description}`,
    `Severity: ${finding.severity}`,
    '',
    'Respond with a brief assessment and suggested priority (P0-P4).',
  ].join('\n');

  const response = await llamafileComplete(prompt, config);
  return {
    assessment: response.text,
    suggestedPriority: extractPriority(response.text),
  };
}

function extractPriority(text: string): string {
  const match = text.match(/P[0-4]/);
  return match?.[0] ?? 'P2';
}
