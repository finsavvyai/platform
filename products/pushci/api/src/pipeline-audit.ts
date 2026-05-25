// Pipeline security audit: scan pushci.yml for risky patterns, secrets, unsafe commands.

import { Hono } from "hono";
import type { Env } from "./types";

export const auditRoutes = new Hono<{ Bindings: Env }>();

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface AuditFinding {
  severity: Severity;
  rule: string;
  message: string;
  line?: number;
}

export interface AuditResult {
  score: number;
  findings: AuditFinding[];
  passed: boolean;
}

const RULES: Array<{
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
}> = [
  { id: "secret-plaintext", severity: "critical",
    pattern: /(?:password|secret|token|api_key|apikey|private_key)\s*[:=]\s*["'][^${}]+["']/i,
    message: "Hardcoded secret detected. Use `pushci secret set` instead." },
  { id: "shell-injection", severity: "critical",
    pattern: /\$\{?\w*INPUT|eval\s|exec\s|\$\(/i,
    message: "Potential shell injection via unsanitized input." },
  { id: "curl-pipe-sh", severity: "high",
    pattern: /curl\s.*\|\s*(?:ba)?sh/i,
    message: "Piping curl to shell is unsafe. Download and verify first." },
  { id: "privileged-run", severity: "high",
    pattern: /sudo\s|--privileged|--cap-add/i,
    message: "Privileged execution detected. Use least-privilege." },
  { id: "no-timeout", severity: "medium",
    pattern: /^(?!.*timeout)/,
    message: "No timeout configured. Add `timeout:` to prevent hung builds." },
  { id: "wildcard-permissions", severity: "medium",
    pattern: /permissions\s*:\s*["']?\*["']?/i,
    message: "Wildcard permissions detected. Scope to specific actions." },
  { id: "http-not-https", severity: "medium",
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/i,
    message: "Insecure HTTP URL detected. Use HTTPS." },
  { id: "npm-audit-missing", severity: "low",
    pattern: /npm\s+(?:install|ci)(?!.*audit)/i,
    message: "Consider adding `npm audit` after install for vulnerability scanning." },
  { id: "no-pin-version", severity: "low",
    pattern: /(?:node|python|go|ruby|java)\s*:\s*["']?latest["']?/i,
    message: "Using 'latest' version tag. Pin to specific version for reproducibility." },
  { id: "env-dump", severity: "high",
    pattern: /printenv|env\s*$|set\s*$/im,
    message: "Environment dump may leak secrets to logs." },
];

export function auditPipeline(yaml: string): AuditResult {
  const lines = yaml.split("\n");
  const findings: AuditFinding[] = [];

  for (const rule of RULES) {
    if (rule.id === "no-timeout") {
      if (!yaml.includes("timeout")) {
        findings.push({ severity: rule.severity, rule: rule.id, message: rule.message });
      }
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        findings.push({ severity: rule.severity, rule: rule.id, message: rule.message, line: i + 1 });
      }
    }
  }

  const severityWeights: Record<Severity, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };
  const deductions = findings.reduce((sum, f) => sum + severityWeights[f.severity], 0);
  const score = Math.max(0, 100 - deductions);

  return { score, findings, passed: !findings.some((f) => f.severity === "critical" || f.severity === "high") };
}

auditRoutes.post("/audit", async (c) => {
  const { yaml } = await c.req.json<{ yaml: string }>();
  if (!yaml) return c.json({ error: "yaml is required" }, 400);
  return c.json(auditPipeline(yaml));
});
