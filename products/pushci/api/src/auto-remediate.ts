// Auto-remediation: AI-generated fixes for pipeline audit findings and failures.

import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import { verifyJwt } from "./auth";
import { auditPipeline } from "./pipeline-audit";
import type { Env } from "./types";
import type { AuditFinding } from "./pipeline-audit";

type Bindings = Env;
export const remediateRoutes = new Hono<{ Bindings: Bindings }>();

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

/** POST /fix — audit yaml and return AI-generated fix. */
remediateRoutes.post("/fix", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { yaml } = await c.req.json<{ yaml: string }>();
  if (!yaml) return c.json({ error: "yaml is required" }, 400);

  const audit = auditPipeline(yaml);
  if (audit.passed && audit.findings.length === 0) {
    return c.json({ fixed: yaml, audit, changes: [], message: "No issues found." });
  }

  const fixedYaml = applyStaticFixes(yaml, audit.findings);
  const changes = describeChanges(audit.findings);

  // For critical/high findings, also ask AI for explanations
  const critical = audit.findings.filter((f) => f.severity === "critical" || f.severity === "high");
  let aiAdvice = "";
  if (critical.length > 0 && c.env.ANTHROPIC_API_KEY) {
    aiAdvice = await getAIAdvice(c.env, yaml, critical);
  }

  const reaudit = auditPipeline(fixedYaml);
  return c.json({ fixed: fixedYaml, audit: reaudit, changes, aiAdvice });
});

/** POST /diagnose — diagnose a failed run with AI. */
remediateRoutes.post("/diagnose", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const { logs, yaml, error: errorMsg } = await c.req.json<{
    logs?: string; yaml?: string; error?: string;
  }>();

  if (!logs && !errorMsg) return c.json({ error: "logs or error required" }, 400);

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const prompt = [
    "Diagnose this CI/CD failure. Respond with: root cause, fix steps, and prevention.",
    yaml ? `\nPipeline config:\n\`\`\`yaml\n${yaml.slice(0, 2000)}\n\`\`\`` : "",
    errorMsg ? `\nError: ${errorMsg}` : "",
    logs ? `\nLogs (last 3000 chars):\n\`\`\`\n${logs.slice(-3000)}\n\`\`\`` : "",
  ].join("");

  const msg = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text).join("\n");

  return c.json({ diagnosis: text });
});

function applyStaticFixes(yaml: string, findings: AuditFinding[]): string {
  let fixed = yaml;
  for (const f of findings) {
    switch (f.rule) {
      case "no-timeout":
        if (!fixed.includes("timeout:")) fixed = `timeout: 300\n${fixed}`;
        break;
      case "http-not-https":
        fixed = fixed.replace(/http:\/\/(?!localhost|127\.0\.0\.1)/g, "https://");
        break;
      case "no-pin-version":
        fixed = fixed.replace(/:\s*["']?latest["']?/g, ': "lts"');
        break;
    }
  }
  return fixed;
}

function describeChanges(findings: AuditFinding[]): string[] {
  return findings.map((f) => {
    switch (f.rule) {
      case "no-timeout": return "Added timeout: 300 (5 min default)";
      case "http-not-https": return "Upgraded HTTP URLs to HTTPS";
      case "no-pin-version": return "Pinned 'latest' tags to 'lts'";
      default: return `${f.rule}: ${f.message}`;
    }
  });
}

async function getAIAdvice(env: Env, yaml: string, findings: AuditFinding[]): Promise<string> {
  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const findingsText = findings.map((f) =>
      `[${f.severity}] ${f.rule}: ${f.message}${f.line ? ` (line ${f.line})` : ""}`
    ).join("\n");

    const msg = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Fix these CI/CD security issues. Be concise.\n\nConfig:\n${yaml.slice(0, 1500)}\n\nFindings:\n${findingsText}`,
      }],
    });

    return msg.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text).join("\n");
  } catch {
    return "";
  }
}
