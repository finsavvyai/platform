// AI gateway routes for PushCI: pipeline gen, failure diagnosis, conversion.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { generatePipelinePrompt, explainFailurePrompt, convertActionsPrompt } from "./ai-prompts";
import { tools, handleToolUse } from "./ai-tools";
import { extractYamlBlock, redactSecrets } from "./ai-validator";

type AiEnv = { ANTHROPIC_API_KEY: string };

export const aiRoutes = new Hono<{ Bindings: AiEnv }>();

function getClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

async function callClaude(
  client: Anthropic,
  system: string,
  user: string,
  useTools = false
): Promise<Anthropic.Messages.Message> {
  return client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
    ...(useTools ? { tools } : {}),
  });
}

aiRoutes.post("/generate-pipeline", async (c) => {
  const body = await c.req.json();
  const ctx = {
    repoName: body.repoName ?? "unknown",
    languages: body.languages ?? [],
    packageManagers: body.packageManagers ?? [],
    frameworks: body.frameworks ?? [],
    buildFiles: body.buildFiles ?? [],
  };
  const { system, user } = generatePipelinePrompt(ctx);
  const client = getClient(c.env.ANTHROPIC_API_KEY);
  const msg = await callClaude(client, system, redactSecrets(user), true);
  // Handle tool use loop
  let response = msg;
  if (response.stop_reason === "tool_use") {
    const toolResults = await handleToolUse(response.content);
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ],
      tools,
    });
  }
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const yaml = extractYamlBlock(text);
  return c.json({ yaml, raw: yaml ? undefined : text });
});

aiRoutes.post("/explain-failure", async (c) => {
  const body = await c.req.json();
  const ctx = {
    logs: body.logs ?? "",
    checkName: body.checkName ?? "unknown",
    exitCode: body.exitCode,
  };
  const { system, user } = explainFailurePrompt(ctx);
  const client = getClient(c.env.ANTHROPIC_API_KEY);
  const msg = await callClaude(client, system, redactSecrets(user));
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return c.json({ explanation: text });
});

aiRoutes.post("/convert-actions", async (c) => {
  const body = await c.req.json();
  const actionsYaml = body.yaml ?? "";
  const { system, user } = convertActionsPrompt(actionsYaml);
  const client = getClient(c.env.ANTHROPIC_API_KEY);
  const msg = await callClaude(client, system, user);
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const yaml = extractYamlBlock(text);
  return c.json({ yaml, raw: yaml ? undefined : text });
});
