// Skill explanation endpoint — uses cheap model to explain skills.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import { verifyJwt } from "./auth";
import { getSkillById } from "./skills";
import type { Env } from "./types";

type Bindings = Env;
export const skillExplainRoutes = new Hono<{ Bindings: Bindings }>();

const EXPLAIN_RATE_KEY_PREFIX = "skill-explain-rl";
const EXPLAIN_PER_MINUTE = 5;

skillExplainRoutes.post("/:id/explain", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  // Per-user per-minute rate limit for explain calls
  const minuteKey = `${EXPLAIN_RATE_KEY_PREFIX}:${user.sub}:${Math.floor(Date.now() / 60000)}`;
  const current = parseInt((await c.env.RUNNERS.get(minuteKey)) ?? "0", 10);
  if (current >= EXPLAIN_PER_MINUTE) {
    return c.json({
      error: "rate_limited",
      message: `Skill explain limited to ${EXPLAIN_PER_MINUTE} requests per minute. Try again shortly.`,
    }, 429);
  }
  await c.env.RUNNERS.put(minuteKey, String(current + 1), { expirationTtl: 120 });

  const skillId = c.req.param("id");
  const skill = getSkillById(skillId);
  if (!skill) return c.json({ error: "skill not found" }, 404);

  const body = await c.req.json<{ question?: string }>().catch(() => ({ question: undefined }));
  const question = (body.question ?? "").slice(0, 300) || "How does this skill work and what do I need to set up?";

  const skillContext = [
    `Skill: ${skill.name} (${skill.id})`,
    `Category: ${skill.category}`,
    `Author: ${skill.author}`,
    `Tier: ${skill.tier}`,
    `Description: ${skill.description}`,
    `Steps: ${skill.steps.map((s, i) => `${i + 1}. ${s.name}: \`${s.run}\`${s.on_fail ? ` (on_fail: ${s.on_fail})` : ""}`).join("; ")}`,
    skill.config ? `Config required: ${Object.entries(skill.config).map(([k, v]) => `${k}=${v || "(required)"}`).join(", ")}` : "",
    skill.gateway ? `Gateway: ${skill.gateway}` : "",
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 512,
    system: `You are PushCI's skill assistant. Explain CI/CD skills concisely.
Be practical: what does each step do, what prerequisites are needed,
what config/credentials the user must set up, and when this skill
is useful vs not. If the skill requires external services (AWS, GCP,
Docker, etc.), clearly state what accounts/CLI tools are needed.
Keep answers under 200 words. Use markdown for formatting.`,
    messages: [{
      role: "user",
      content: `${skillContext}\n\nUser question: ${question}`,
    }],
  });

  const text = msg.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text"
  );

  return c.json({
    skill_id: skillId,
    explanation: text?.text ?? "Could not generate explanation.",
    question,
  });
});
