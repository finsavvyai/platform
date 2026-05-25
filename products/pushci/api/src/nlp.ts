// NLP endpoint: natural language DevOps commands via Claude tool use.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { verifyJwt } from "./auth";
import { agentCoreConfigured, askAgentCore } from "./agent-client";
import { getProjectByRepoForUser } from "./db";
import { buildProjectContext } from "./nlp-context";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import type { Env } from "./types";

type NlpEnv = Env;

export const nlpRoutes = new Hono<{ Bindings: NlpEnv }>();

const nlpTools: Anthropic.Messages.Tool[] = [
  tool("run_pipeline", "Run CI pipeline checks", {
    checks: { type: "array", items: { type: "string" }, description: "Checks to run" },
  }),
  tool("deploy", "Deploy project to target", {
    target: { type: "string", description: "Deploy target (staging, production, etc.)" },
    branch: { type: "string", description: "Branch to deploy" },
  }),
  tool("diagnose_failure", "Diagnose last CI failure with root cause analysis", {}),
  tool("show_status", "Show last CI run status", {}),
  tool("update_config", "Update pushci.yml config", {
    key: { type: "string", description: "Config key" },
    value: { type: "string", description: "New value" },
  }),
  tool("manage_secret", "Manage secrets", {
    operation: { type: "string", description: "set, get, list, delete" },
    key: { type: "string", description: "Secret key" },
  }),
  tool("optimize_pipeline", "Analyze and optimize pipeline for speed and cost", {}),
  tool("fix_pipeline", "Auto-fix broken pipeline configuration", {}),
  tool("generate_pipeline", "Generate new CI/CD pipeline from repo analysis", {}),
  tool("heal_pipeline", "Self-heal failed pipeline with auto-retry and fixes", {}),
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

// The assistant is a dual-mode helper:
//
//   1. Action mode — when the user asks to DO something the CLI can
//      execute (run a pipeline, deploy, fix, optimize), call the
//      matching tool so the UI can dispatch it.
//
//   2. Answer mode — when the user asks a question or asks for advice
//      (how do I X, why did Y fail, what should my pipeline look like),
//      answer with useful plain text. Do NOT force a tool call.
//
// The old prompt insisted on a tool for every message, which left the
// UI stuck on "Executing: optimize_pipeline" with no content to render
// because nothing downstream actually executed the action. Allowing
// text answers closes that loop: the user gets the advice they asked
// for, immediately visible in the chat.
const systemPrompt = `You are a CI/CD assistant for PushCI.dev.

You have two modes:

1. ACTION mode — the user asks you to DO something concrete and
   executable from the CLI or dashboard. Call exactly one tool and
   the UI will dispatch it. Examples: "run my pipeline", "deploy to
   staging", "show status", "list secrets".

2. ANSWER mode — the user asks a question, wants advice, or asks you
   to analyze / explain / optimize something without a clear side
   effect. Reply with useful plain text directly. Do NOT pick a tool.
   Examples: "optimize my pipeline" (give concrete suggestions),
   "why did my build fail" (explain the log), "what should my
   pushci.yml look like for a Next.js app?", "how do I add a cache
   step?".

When in doubt, prefer ANSWER mode — a helpful text response is
always better than a dead-end tool call the UI cannot execute.`;

nlpRoutes.post("/ask", async (c) => {
  const { message, repoContext } = await c.req.json<{
    message: string;
    repoContext?: { root?: string; branch?: string };
  }>();
  if (!message) return c.json({ error: "message required" }, 400);

  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  // Pre-flight: when the client sends a repo, verify the user
  // actually has access to it. Protects against cross-tenant
  // context leakage and returns a helpful error the UI can surface.
  let contextBlock = "";
  if (repoContext?.root) {
    const project = await getProjectByRepoForUser(c.env.DB, repoContext.root, user.sub);
    if (!project) {
      return c.json({ error: "forbidden" }, 403);
    }
    contextBlock = await buildProjectContext(c.env, repoContext.root, repoContext.branch, user.sub);
  }

  if (agentCoreConfigured(c.env)) {
    try {
      const response = await askAgentCore(c.env, "pushci-default", message, repoContext);
      if (response) {
        return c.json({
          action: "agent_core",
          params: { sessionId: response.sessionId },
          message: response.message,
        });
      }
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : "agent-core request failed",
      }, 502);
    }
  }

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const userContent = contextBlock
    ? `${contextBlock}\n\nUser question: ${message}`
    : message;

  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
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

  // Action mode: Claude picked a tool. Return it so the UI can
  // dispatch. We also include any text Claude wrote alongside the
  // tool call as a short pre-action note.
  if (toolBlock) {
    return c.json({
      action: toolBlock.name,
      params: toolBlock.input,
      message: textBlock?.text ?? `Executing: ${toolBlock.name}`,
    });
  }

  // Answer mode: Claude wrote a plain text response. This is the
  // common case for "optimize my pipeline", "why did X fail", etc.
  // No action field — the UI just renders the message as a normal
  // assistant reply, no stuck spinner.
  if (textBlock?.text) {
    return c.json({ message: textBlock.text });
  }

  // Empty response — shouldn't happen, but fall back cleanly.
  return c.json({
    message: "I couldn't find a useful answer. Try rephrasing the question — for example, 'why did my last build fail?' or 'what should my pushci.yml look like for a Next.js app?'",
  });
});

// buildProjectContext lives in nlp-context.ts
