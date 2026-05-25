---
name: opensyber-marketplace
description: Use when a user wants to browse, install, configure, publish, or monetize OpenSyber runtime skills, or work with skill bundles like the AI Security Analyst ($99) or AI Agent Defence ($49). Covers status badges, install flow, publisher revenue, and bundle composition.
---

# OpenSyber Marketplace

The OpenSyber marketplace at https://opensyber.cloud/marketplace lists runtime skills installable into hosted security agents. Publishers earn 70% revenue share on paid skills. Categories: security, developer, communication, productivity, utilities, finance, home.

## When to use this skill

User mentions: "OpenSyber marketplace", "install a skill", "publish a skill", "AI Security Analyst bundle", "AI Agent Defence bundle", "skill revenue", "marketplace categories", "Coming Soon badge", "Needs Config badge".

## Skill lifecycle status

Each listing shows a badge derived from the manifest's `status` field:

| Badge | Meaning | Action |
|-------|---------|--------|
| (no badge) — Verified | Live, no config needed | One-click install |
| **Needs Config** (blue) | Code complete, requires env var | Install + connect (LLM key, webhook URL, etc.) |
| **Coming Soon** (amber) | Manifest defined, handler not implemented | Disabled button; user notified at launch |

When recommending a skill, check the status. Suggesting an install for a `coming-soon` skill is a bug.

## Install flow

```ts
// JWT-authenticated dashboard call
await fetch(`/api/instances/${instanceId}/skills`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authJsToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    skillId: 'skill_abc123',
    version: '1.2.0',
  }),
})
```

The agent receives a hot-load signal, pulls the skill tarball from R2 (`bundle_r2_key`), verifies SHA-256 checksum, and spawns it as a new worker_thread.

## Bundles (paid skill packs)

### AI Security Analyst — $99/mo (6 skills)
- `ai-reasoning-engine` — root cause + risk scoring
- `ai-triage` — batch prioritization
- `ai-remediation` — fix generation with rollback
- `ai-threat-intel` — CVE + OSINT enrichment
- `ai-compliance-writer` — SOC 2 / ISO / HIPAA / GDPR evidence
- `ai-incident-responder` — attack chain correlation

Saves 47% vs individual purchase. Target tier: Pro and above.

### AI Agent Defence — $49/mo (3 skills, self-hosted)
- `prompt-guard` — neural injection detection (Superagent guard-1.7B via Ollama)
- `ruflo-aidefence` — 27 regex patterns (<1ms)
- `voice-synthesis` — spoken security briefings (Voicebox over Tailscale)

Zero external API calls. HIPAA/GDPR compliant by architecture.

## Publisher flow

1. Build a runtime skill (see `opensyber-runtime-skills` skill)
2. Submit via `pnpm skill:publish` — uploads tarball to R2, creates `marketplace_submissions` row
3. Status transitions: `pending → scanning → reviewing → approved`
4. Once approved, the skill appears in the public marketplace
5. Paid skills: 70% to publisher, 30% to platform. Monthly payouts via `publisher_payouts` table.

## Categories (canonical)

```ts
type SkillCategory =
  | 'security'        // CSPM, EDR, IAM, secrets
  | 'developer'       // CI/CD, code review, deps
  | 'communication'   // Slack, email, Teams
  | 'productivity'    // Jira, Notion, AI agents
  | 'utilities'       // Logs, monitoring, runtime
  | 'finance'         // Cost, compliance
  | 'home'            // Infrastructure
```

The web UI shows mission-framed display labels (security → "Security", productivity → "AI Agents", finance → "Compliance"), defined in `MARKETPLACE_LABELS` in `apps/web/src/app/marketplace/page.tsx`.

## Verification

Skills carry up to 3 optional trust badges:
- **Verified** — manual review passed (`verificationStatus: 'approved'`)
- **Signed** — Sigstore signature verified at publish time
- **SBOM** — Software Bill of Materials available

Recommend Verified + Signed + SBOM for enterprise installs.

## Do not

- Do not recommend installing a `coming-soon` skill. Suggest the live alternative if one exists.
- Do not recommend bypassing verification. The `verificationStatus` enum exists for a reason.
- Do not skip the `version` field when installing — it pins the deploy and supports rollback.
- Do not assume revenue share percentages without checking the latest `publisher_payouts` schema.
