// Process incoming channel messages through PushCI NLP pipeline.
// Converts natural language CI/CD commands into actions and returns results.

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import type { Env } from "./types";
import type { ChannelConnection, IncomingMessage } from "./channel-types";
import { agentCoreConfigured, askAgentCore } from "./agent-client";

const systemPrompt = `You are PushCI, an AI CI/CD assistant responding via messaging.
The user sends commands about their CI/CD pipeline via WhatsApp, Slack, Discord, or Telegram.
Keep responses concise (under 500 chars when possible).
Available actions: run pipeline, deploy, diagnose failures, show status, optimize, fix, heal.
If the message is a greeting, respond briefly with what you can do.
If unclear, ask for clarification.`;

export async function processChannelMessage(
  env: Env,
  conn: ChannelConnection,
  msg: IncomingMessage,
): Promise<string> {
  try {
    // Guard user input through self-hosted Claw before LLM processing
    const guardBlock = await guardInput(env, msg.text);
    if (guardBlock) return `PushCI: Message blocked by security guard (${guardBlock}).`;

    // Try agent-core first if configured
    if (agentCoreConfigured(env)) {
      const response = await askAgentCore(env, conn.default_agent, msg.text);
      if (response?.message) return formatResponse(response.message, msg.platform);
    }

    // Fall back to direct Claude call
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const result = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: msg.text }],
    });

    const text = result.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return formatResponse(text || "I couldn't process that. Try: run, deploy, status, diagnose.", msg.platform);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "unknown error";
    return `PushCI error: ${errMsg.slice(0, 200)}. Try again or check dashboard.`;
  }
}

/** Guard input via self-hosted Claw /v1/guard. Returns violation string or null. */
async function guardInput(env: Env, input: string): Promise<string | null> {
  const url = (env as unknown as Record<string, string>).CLAW_GATEWAY_URL;
  const key = (env as unknown as Record<string, string>).CLAW_API_KEY;
  if (!url || !key || !input) return null;

  try {
    const res = await fetch(`${url}/v1/guard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { classification: string; violationTypes?: string[] };
    if (data.classification === "block") return (data.violationTypes ?? []).join(", ") || "injection";
  } catch { /* fail-open */ }
  return null;
}

function formatResponse(text: string, platform: string): string {
  const prefix = "PushCI";
  // Slack supports markdown, WhatsApp uses *bold*, Telegram uses Markdown
  if (platform === "slack") return `*${prefix}:*\n${text}`;
  if (platform === "whatsapp") return `*${prefix}:*\n${text}`;
  if (platform === "telegram") return `*${prefix}:*\n${text}`;
  return `${prefix}:\n${text}`;
}
