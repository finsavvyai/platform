// Secrets Scanning API — detect leaked credentials in code and logs.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

export const secretsScanRoutes = new Hono<{ Bindings: Env }>();

type SecretSeverity = "critical" | "high" | "medium";

interface SecretPattern {
  type: string;
  pattern: string;
  regex: RegExp;
  severity: SecretSeverity;
}

export interface SecretFinding {
  type: string;
  pattern: string;
  line: number;
  column: number;
  snippet: string;
  severity: SecretSeverity;
}

const PATTERNS: SecretPattern[] = [
  {
    type: "aws_key",
    pattern: "AWS Access Key",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
  },
  {
    type: "github_token",
    pattern: "GitHub Token",
    regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
    severity: "critical",
  },
  {
    type: "generic_api_key",
    pattern: "Generic API Key",
    regex: /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][A-Za-z0-9/+=]{20,}/gi,
    severity: "high",
  },
  {
    type: "jwt_token",
    pattern: "JWT Token",
    regex: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
    severity: "high",
  },
  {
    type: "private_key",
    pattern: "Private Key",
    regex: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    type: "slack_token",
    pattern: "Slack Token",
    regex: /xox[bpas]-[0-9a-zA-Z-]+/g,
    severity: "high",
  },
  {
    type: "generic_password",
    pattern: "Generic Password",
    regex: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/gi,
    severity: "medium",
  },
  {
    type: "connection_string",
    pattern: "Connection String",
    regex: /(mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi,
    severity: "critical",
  },
];

function redact(match: string): string {
  if (match.length <= 8) return "****";
  return match.slice(0, 4) + "****" + match.slice(-4);
}

export function scanForSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split("\n");

  for (const pat of PATTERNS) {
    // Reset regex state for each scan
    const regex = new RegExp(pat.regex.source, pat.regex.flags);

    for (let i = 0; i < lines.length; i++) {
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;

      while ((match = regex.exec(lines[i])) !== null) {
        const col = match.index;
        const full = match[0];

        // Build context snippet with redacted secret
        const start = Math.max(0, col - 10);
        const end = Math.min(lines[i].length, col + full.length + 10);
        const before = lines[i].slice(start, col);
        const after = lines[i].slice(col + full.length, end);
        const snippet = before + redact(full) + after;

        findings.push({
          type: pat.type,
          pattern: pat.pattern,
          line: i + 1,
          column: col + 1,
          snippet,
          severity: pat.severity,
        });
      }
    }
  }

  return findings;
}

// Scan text or logs for secrets
secretsScanRoutes.post("/scan", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{ text?: string; logs?: string }>();
  const input = body.text ?? body.logs;

  if (!input) {
    return c.json({ error: "text or logs field is required" }, 400);
  }

  const findings = scanForSecrets(input);
  return c.json({ findings, clean: findings.length === 0 });
});

// List all patterns being scanned
secretsScanRoutes.get("/patterns", async (c) => {
  const list = PATTERNS.map((p) => ({
    type: p.type,
    pattern: p.pattern,
    severity: p.severity,
  }));
  return c.json({ patterns: list, count: list.length });
});
