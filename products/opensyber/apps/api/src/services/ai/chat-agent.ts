/**
 * AI Chat Agent
 *
 * Real conversational agent powered by Claude. Maintains context
 * across messages and responds in the user's language.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

const SYSTEM_PROMPT = `You are the OpenSyber AI assistant — a helpful, knowledgeable guide for the OpenSyber platform.

IMPORTANT: Always respond in the same language the user writes in. If they write in Hebrew, respond in Hebrew. If Spanish, respond in Spanish. If Japanese, respond in Japanese. Detect the language automatically.

About OpenSyber:
- OpenSyber is the runtime security monitor for AI coding agents (Cursor, Copilot, Cline, Devin, Claude Code)
- It shows developers and CISOs exactly what their AI agents did while they weren't watching
- Monitors: file access, terminal commands, network calls, secret/credential access
- Key features:
  * Agent Activity Dashboard — real-time monitoring of all AI agent actions
  * CSPM — cloud security scanning for AWS, GCP, Azure (misconfigurations, IAM issues)
  * Skill Marketplace — 15+ verified security skills (Secret Scanner, Dependency Auditor, SIEM Forwarder, etc.)
  * Attack Path Analysis — blast radius visualization showing what a compromised agent can reach
  * OASF Compliance — 15 AI agent security controls mapped to SOC2, ISO 27001, NIST CSF
  * SaaS Posture — OAuth app risk scoring, AI agent token detection
  * Remediation Engine — automated playbook execution with rollback
  * Supply Chain Security — dependency scanning, postinstall script blocking, exfiltration domain blocking
- Plans: Free (1 agent, 7-day history), Pro ($99/mo, 5 agents), Team ($399/mo, unlimited), Enterprise (custom, SSO, SCIM)
- Tech stack: Cloudflare Workers (API), Next.js (Web), Hono framework, D1/SQLite, R2 storage
- VS Code extension: "OpenAgent" — monitors agent activity locally, optional cloud sync
- CLI: npx opensyber-scan

Be concise, helpful, and specific. Reference exact feature names and navigation paths in the dashboard.
If you don't know something, say so honestly rather than guessing.`;

/**
 * Send a conversational message to Claude with full chat history.
 */
export async function chatWithAgent(
  apiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown');
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  return data.content?.[0]?.text ?? '';
}

/**
 * Stream a conversational reply from Claude. Yields text chunks as they
 * arrive from Anthropic's SSE stream. Caller is responsible for framing
 * each chunk into whatever downstream transport it uses (SSE, WebSocket,
 * raw bytes). Throws on non-2xx responses just like chatWithAgent.
 */
export async function* streamWithAgent(
  apiKey: string,
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text().catch(() => 'Unknown');
    throw new Error(`Anthropic stream error ${response.status}: ${errorBody}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip malformed SSE frames rather than aborting the whole stream.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
