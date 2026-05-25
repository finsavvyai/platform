/** LLM provider routing: OpenAI, Anthropic, Ollama/OpenCLaw. */

import { json } from "./middleware.js";
import { convertAnthropicStream, convertOllamaStream } from "./stream.js";

// ── Model → Provider routing ────────────────────────────────────────
const MODEL_ROUTES = [
  [/^gpt-/i, "openai"],
  [/^o[134]-/i, "openai"],
  [/^chatgpt-/i, "openai"],
  [/^claude-/i, "anthropic"],
  [/^llama/i, "ollama"],
  [/^mistral/i, "ollama"],
  [/^mixtral/i, "ollama"],
  [/^phi/i, "ollama"],
  [/^gemma/i, "ollama"],
  [/^qwen/i, "ollama"],
  [/^deepseek/i, "ollama"],
  [/^command-r/i, "ollama"],
];

export function resolveProvider(model) {
  for (const [re, name] of MODEL_ROUTES) {
    if (re.test(model)) return name;
  }
  return null;
}

// ── Provider: OpenAI ────────────────────────────────────────────────
export async function openaiChat(body, env, stream) {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens,
      stream,
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
  return resp;
}

// ── Provider: Anthropic ─────────────────────────────────────────────
export async function anthropicChat(body, env, stream) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const messages = body.messages.filter((m) => m.role !== "system");
  const systemMsg = body.messages.find((m) => m.role === "system");

  const anthropicBody = {
    model: body.model,
    max_tokens: body.max_tokens || 4096,
    messages: messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    stream,
  };
  if (systemMsg) anthropicBody.system = systemMsg.content;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicBody),
  });
  if (!resp.ok)
    throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);

  if (stream) return convertAnthropicStream(resp, body.model);

  const data = await resp.json();
  let content = "";
  for (const block of data.content || []) {
    if (block.type === "text") content += block.text;
  }
  return json(
    {
      id: `chatcmpl-${crypto.randomUUID().slice(0, 12)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: data.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason:
            data.stop_reason === "end_turn" ? "stop" : data.stop_reason,
        },
      ],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens:
          (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      provider: "anthropic",
    },
    200,
    {},
  );
}

// ── Provider: Ollama / OpenCLaw ─────────────────────────────────────
export async function ollamaChat(body, env, stream = false) {
  const base = (env.OLLAMA_BASE_URL || "http://localhost:11434").replace(
    /\/$/,
    "",
  );
  const resp = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      stream,
      options: {
        temperature: body.temperature ?? 0.7,
        top_p: body.top_p ?? 1.0,
        ...(body.max_tokens ? { num_predict: body.max_tokens } : {}),
      },
    }),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);

  if (stream) return convertOllamaStream(resp, body);

  const data = await resp.json();
  return new Response(
    JSON.stringify({
      id: `chatcmpl-${crypto.randomUUID().slice(0, 12)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: data.model || body.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: data.message?.content || "",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      provider: "ollama",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
