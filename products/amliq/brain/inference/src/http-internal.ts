/**
 * Internal HTTP/retry helpers shared by ClusterInferenceProvider.
 * Not part of the public API; do not re-export from index.ts.
 */

import {
  type CompletionRequest,
  type CompletionResponse,
  InferenceProviderError,
  InferenceTransportError,
} from "./types.js";

export function isRetryable(err: unknown): boolean {
  if (err instanceof InferenceProviderError) return false; // 4xx never retried
  if (err instanceof InferenceTransportError) return true; // 5xx + timeout + network
  return true; // unknown -> retry (matches ai-gateway pattern)
}

export function backoffMs(
  attempt: number,
  base: number,
  cap: number,
  jitter: () => number,
): number {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  const lo = base;
  const hi = Math.max(lo, exp);
  const j = clamp01(jitter());
  return Math.floor(lo + (hi - lo) * j);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function isAbort(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError";
}

export async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}

export function toOpenAiBody(req: CompletionRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: false,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.max_tokens !== undefined) body.max_tokens = req.max_tokens;
  if (req.stop !== undefined) body.stop = req.stop;
  if (req.tools !== undefined) body.tools = req.tools;
  if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
  return body;
}

export function fromOpenAiBody(
  providerId: string,
  fallbackModel: string,
  json: Record<string, unknown>,
): CompletionResponse {
  const id = typeof json.id === "string" ? json.id : "";
  const model = typeof json.model === "string" ? json.model : fallbackModel;
  const created =
    typeof json.created === "number" ? json.created : Math.floor(Date.now() / 1000);
  const choices = Array.isArray(json.choices)
    ? (json.choices as CompletionResponse["choices"])
    : [];
  const usage = (json.usage as CompletionResponse["usage"]) ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  return { id, model, created, choices, usage, providerId };
}
