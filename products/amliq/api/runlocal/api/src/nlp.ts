// NLP endpoint: natural language DevOps commands via Claude tool use.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";

type NlpEnv = { ANTHROPIC_API_KEY: string };

export const nlpRoutes = new Hono<{ Bindings: NlpEnv }>();

const nlpTools: Anthropic.Messages.Tool[] = [
  tool("run_pipeline", "Run CI pipeline checks", {
    checks: { type: "array", items: { type: "string" }, description: "Checks to run" },
  }),
  tool("deploy", "Deploy project to target", {
    target: { type: "string", description: "Deploy target (staging, production, etc.)" },
  }),
  tool("diagnose_failure", "Diagnose last CI failure", {}),
  tool("show_status", "Show last CI run status", {}),
  tool("update_config", "Update pushci.yml config", {
    key: { type: "string", description: "Config key" },
    value: { type: "string", description: "New value" },
  }),
  tool("manage_secret", "Manage secrets", {
    operation: { type: "string", description: "set, get, list, delete" },
    key: { type: "string", description: "Secret key" },
  }),
];

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>
): Anthropic.Messages.Tool {
  return {
    name,
    description,
    input_schema: { type: "object" as const, properties },
  };
}

const systemPrompt = `You are a CI/CD assistant for PushCI.dev.
The user gives natural language commands about their CI/CD pipeline.
Call exactly one tool to fulfill the request. Never reply with only text.`;

nlpRoutes.post("/ask", async (c) => {
  const { message, repoContext } = await c.req.json<{
    message: string;
    repoContext?: { root?: string; branch?: string; lastRun?: string };
  }>();
  if (!message) return c.json({ error: "message required" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const userContent = repoContext
    ? `Repo: ${repoContext.root ?? "unknown"}, Branch: ${repoContext.branch ?? "main"}, Last: ${repoContext.lastRun ?? "n/a"}\n\nUser: ${message}`
    : message;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
    tools: nlpTools,
  });

  const toolBlock = msg.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
  );
  const textBlock = msg.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text"
  );

  if (toolBlock) {
    return c.json({
      action: toolBlock.name,
      params: toolBlock.input,
      message: textBlock?.text ?? `Executing: ${toolBlock.name}`,
    });
  }

  return c.json({
    action: "show_status",
    params: {},
    message: textBlock?.text ?? "I could not determine the action.",
  });
});
