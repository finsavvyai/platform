import type { Env } from "./types";

interface AgentSessionContext {
  root?: string;
  branch?: string;
  lastRun?: string;
}

interface CreateSessionResponse {
  session_id: string;
  product: string;
  tenant_id: string;
}

interface PostMessageEvent {
  type: string;
  delta?: string;
  message?: string;
}

interface PostMessageResponse {
  events?: PostMessageEvent[];
}

function hasAgentCore(env: Env): boolean {
  return Boolean(env.AGENT_CORE_URL && env.AGENT_CORE_TOKEN);
}

function buildHeaders(env: Env): HeadersInit {
  if (!env.AGENT_CORE_TOKEN) {
    throw new Error("AGENT_CORE_TOKEN is not configured");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.AGENT_CORE_TOKEN}`,
    "X-Agent-Core-Token": env.AGENT_CORE_TOKEN,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export async function askAgentCore(
  env: Env,
  tenantId: string,
  message: string,
  repoContext?: AgentSessionContext
): Promise<{ message: string; sessionId: string } | null> {
  if (!hasAgentCore(env)) return null;

  const baseUrl = normalizeBaseUrl(env.AGENT_CORE_URL!);

  const sessionRes = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: buildHeaders(env),
    body: JSON.stringify({
      product: "pushci",
      tenant_id: tenantId,
      context: repoContext ?? {},
    }),
  });

  if (!sessionRes.ok) {
    const text = await sessionRes.text();
    throw new Error(`agent-core session create failed: ${sessionRes.status} ${text}`);
  }

  const session = await sessionRes.json<CreateSessionResponse>();
  const messageRes = await fetch(`${baseUrl}/sessions/${session.session_id}/messages`, {
    method: "POST",
    headers: buildHeaders(env),
    body: JSON.stringify({ message }),
  });

  if (!messageRes.ok) {
    const text = await messageRes.text();
    throw new Error(`agent-core message failed: ${messageRes.status} ${text}`);
  }

  const payload = await messageRes.json<PostMessageResponse>();
  const assistantText = payload.events
    ?.filter((event) => event.type === "assistant_text")
    .map((event) => event.delta ?? "")
    .join("")
    .trim();

  return {
    message: assistantText || "agent-core accepted the message but returned no assistant text",
    sessionId: session.session_id,
  };
}

export function agentCoreConfigured(env: Env): boolean {
  return hasAgentCore(env);
}
