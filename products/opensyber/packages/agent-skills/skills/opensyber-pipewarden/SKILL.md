---
name: opensyber-pipewarden
description: Use when a user wants to ingest CI/CD pipeline security findings from PipeWarden (DevSecOps scanner) into OpenSyber, scan GitHub Actions / GitLab CI / Bitbucket Pipelines, or wire pipeline findings into AI triage and remediation. Covers webhook setup, HMAC signature verification, and finding correlation.
---

# OpenSyber + PipeWarden

PipeWarden is a sibling DevSecOps scanner that audits CI/CD pipelines (GitHub Actions, GitLab CI/CD, Bitbucket Pipelines) for misconfigurations, supply chain risks, and exposed secrets. OpenSyber ingests PipeWarden findings via webhook and treats them as first-class findings — same triage, AI analysis, and remediation paths.

## When to use this skill

User mentions: "PipeWarden", "pipeline security", "GitHub Actions scan", "GitLab CI security", "CI/CD findings", "supply chain scan", "pipeline-security-scanner skill", "DevSecOps integration".

## Two integration paths

### 1. PipeWarden runtime skill (in-agent)
The `pipeline-security-scanner` skill lives at `skills/pipeline-security-scanner/`. When installed on an agent, it executes PipeWarden scans against connected repos and emits findings to the host agent. Status: `ready` — needs `PIPEWARDEN_API_URL` and `PIPEWARDEN_API_KEY` env to activate.

```ts
// Install via dashboard or API
await opensyber.skills.install({
  instanceId,
  slug: 'pipeline-security-scanner',
  config: {
    PIPEWARDEN_API_URL: 'https://pipewarden.your-domain.cloud',
    PIPEWARDEN_API_KEY: process.env.PIPEWARDEN_KEY,
  },
})
```

### 2. Webhook receiver (external PipeWarden → OpenSyber API)
External PipeWarden deployments POST findings to OpenSyber's API endpoint:

`POST /api/integrations/pipewarden`

Verified via HMAC-SHA256. Payload schema:

```ts
type PipeWardenFinding = {
  id: string;
  repo: string;             // owner/name
  platform: 'github' | 'gitlab' | 'bitbucket';
  engine: 'pipewarden';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence: { file: string; line: number; snippet: string };
  cwe?: string;
  cvss?: number;
  detectedAt: string;       // ISO-8601
}
```

## Webhook signature verification

```ts
// Server side, inside apps/api/src/routes/integrations/pipewarden.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const sig = c.req.header('X-PipeWarden-Signature')
const body = await c.req.text()
const expected = createHmac('sha256', secret).update(body).digest('hex')

if (!sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return c.json({ error: 'invalid_signature' }, 401)
}
```

Always use timing-safe comparison. Never `===` on HMAC outputs.

## Audit endpoint

`POST /api/integrations/pipewarden/audit` accepts scan-event records for compliance trails:

```ts
type PipeWardenEvent = {
  type: 'scan_completed' | 'finding_created' | 'severity_changed';
  scanId: string;
  repo: string;
  timestamp: string;
  meta: Record<string, unknown>;
}
```

Stored in D1 audit log for as long as the org's retention policy allows (default 13 months on Pro tier, 7 years on Enterprise).

## Finding correlation

Once ingested, PipeWarden findings flow into:

1. **AI triage** — `ai-triage` skill batches them with other findings, risk-scores by exploitability + blast radius
2. **AI remediation** — `ai-remediation` skill generates fix PRs for the offending workflow file
3. **Attack-path graph** — pipeline findings link to cloud findings (e.g., "GitHub Action with overly-permissive `permissions: write-all` → AWS deploy role → production S3")
4. **Alert channels** — routes through configured Slack, PagerDuty, Discord, etc.

## Types package

Shared types live at `packages/types/src/pipewarden.ts`:

```ts
export type { PipeWardenFinding, PipeWardenEvent, SeverityLevel, RiskScore }
```

Import these in both OpenSyber API and PipeWarden codebases to keep payloads in sync.

## Recommended setup

For a team that owns both OpenSyber and PipeWarden deployments:

1. Deploy PipeWarden first (separate repo)
2. Generate webhook secret, store in OpenSyber as `PIPEWARDEN_WEBHOOK_SECRET`
3. Configure PipeWarden to POST to `https://api.opensyber.cloud/api/integrations/pipewarden`
4. Install the `ai-triage` skill on at least one OpenSyber agent — findings get AI prioritization automatically

## Do not

- Do not skip HMAC verification on the webhook endpoint. Anyone can POST otherwise.
- Do not use string `===` for signature comparison. Always `timingSafeEqual`.
- Do not store the webhook secret in client-side or repo-checked-in config.
- Do not assume PipeWarden severity == OpenSyber priority. The triage layer re-scores by business context.
- Do not invent the payload schema. Use the canonical `packages/types/src/pipewarden.ts` definition.
