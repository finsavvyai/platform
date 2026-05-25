# MCP Catalog Listings — TenantIQ

Drop-in submission text for the public MCP directories. Three targets:

1. [smithery.ai](https://smithery.ai) — community catalog (PR-based)
2. [modelcontextprotocol.io official servers list](https://modelcontextprotocol.io/servers) — Anthropic-curated
3. npm — `@tenantiq/mcp-msp-toolkit` package metadata for discoverability

---

## 1. smithery.ai (`smithery.yaml`)

```yaml
name: tenantiq
displayName: TenantIQ — MSP M365 Control Plane
description: |
  Multi-tenant Microsoft 365 security & compliance posture for MSPs.
  Read CIS / SOC 2 / HIPAA / GDPR / ISO 27001 / Defender / Intune / PIM
  posture, list drift events with actor attribution, acknowledge alerts,
  apply skill-bundle templates. 13 tools, 3 resources, 6 prompts.
repository: https://github.com/finsavvyai/tenantiq
homepage: https://app.tenantiq.app
documentation: https://app.tenantiq.app/compare
license: Proprietary
version: 0.3.0
keywords:
  - microsoft-365
  - msp
  - security
  - compliance
  - cis-benchmark
  - intune
  - defender-xdr
  - pim
  - drift-detection
  - autonomous

# Streamable HTTP transport — works in Claude Desktop, Cowork, etc.
transport:
  type: http
  url: https://api.tenantiq.app/api/mcp

# Public namespace (no auth) for discovery + lead-gen
publicTransport:
  type: http
  url: https://api.tenantiq.app/api/mcp-public
  description: |
    Unauthenticated namespace exposing scan_domain — anyone can run a free
    public M365 security scan on any domain via Claude. No signup required.

# Demo mode — paste this into Claude Desktop and try the integration in 60s
demoCredentials:
  bearer: tiq_demo_visitor_2026
  description: |
    Synthetic 3-tenant org (Acme / Globex / Initech) with realistic CIS
    posture and drift events. Read-only.

# Authentication for production access
authentication:
  type: bearer
  description: |
    Long-lived API keys minted at https://app.tenantiq.app/settings/api-keys
    (admin role required). Format: tiq_<43 base64url>. SHA-256 hash stored,
    plaintext shown once. Same Bearer also works as the regular session JWT.

capabilities:
  tools: 13          # 10 read + 3 write
  resources: 3       # org/overview, compliance/frameworks, schema/finding
  prompts: 6         # 4 skill templates + explain_posture_gap + qbr_summary

featuredTools:
  - name: list_tenants
    description: Every Azure AD tenant the calling MSP has connected.
  - name: get_cis_posture
    description: Full CIS M365 v3.1 posture for a tenant — pass/fail/partial counts + per-control evidence.
  - name: list_recent_drift
    description: Configuration drift events with actor attribution (who-did-it across tenants).
  - name: apply_skill_template
    description: One-click activate an agent template (onboarding / compliance review / license audit / IR kit).

contact:
  email: info@finsavvyai.com
  twitter: '@tenantiq'
```

---

## 2. modelcontextprotocol.io official PR

Submit a PR to `modelcontextprotocol/servers` (the central README listing). Snippet to add under the **Hosted** section:

```markdown
- **[TenantIQ](https://app.tenantiq.app)** — Multi-tenant Microsoft 365 control plane for MSPs.
  Read CIS / Compliance (SOC 2 / HIPAA / GDPR / ISO 27001) / Intune / PIM /
  Defender XDR posture across N customer tenants from one MCP endpoint;
  drift attribution, alert + drift acknowledgment, agent-template
  activation. Public no-auth namespace for `scan_domain`. Demo key
  `tiq_demo_visitor_2026` works in Claude Desktop with no signup.
```

PR body template:

> # Add TenantIQ to the hosted servers list
>
> TenantIQ ships an MCP server at `https://api.tenantiq.app/api/mcp` plus a
> public no-auth namespace at `/api/mcp-public`. Both are spec-compliant
> against 2025-06-18 — initialize, tools/list+call, resources/list+read,
> prompts/list+get, plus Streamable HTTP transport over GET with
> `Accept: text/event-stream` for server-initiated notifications.
>
> Capabilities snapshot (commit `49aaf25`):
> - 13 tools (10 read, 3 write — role-gated)
> - 3 resources
> - 6 prompts (skill-template wrappers + posture explainer + QBR summary)
>
> Demo mode: anyone can paste `tiq_demo_visitor_2026` into Claude Desktop
> config and get a working synthetic 3-tenant MSP org in 60 seconds.
>
> Source confirmation: `apps/api/src/routes/mcp*.ts` — clean tsc, 1542
> tests passing.

---

## 3. npm — `@tenantiq/mcp-msp-toolkit` (future, OSS slice)

When we open-source the dispatcher scaffold (the JSON-RPC + auth + role
gating + SSE harness, *without* the TenantIQ data path), the npm package
metadata should look like:

```json
{
  "name": "@tenantiq/mcp-msp-toolkit",
  "version": "0.1.0",
  "description": "Battle-tested MCP server scaffold for MSP-vertical SaaS — JSON-RPC dispatcher, auth + role gating, SSE harness, role-based tool exposure.",
  "license": "MIT",
  "keywords": ["mcp", "msp", "model-context-protocol", "claude", "anthropic", "scaffold"],
  "homepage": "https://app.tenantiq.app/compare",
  "repository": "github:finsavvyai/tenantiq-mcp-msp-toolkit"
}
```

---

## Submission checklist

- [ ] Fork `smithery-ai/registry`, add `smithery.yaml` content above to a new directory `servers/tenantiq/`, open PR.
- [ ] Fork `modelcontextprotocol/servers`, add the README line, open PR with the body template.
- [ ] Verify `https://api.tenantiq.app/api/mcp-public` responds with `{"jsonrpc":"2.0",...}` to `tools/list` (no auth required) — should already be live as of commit `49aaf25`.
- [ ] Verify `tiq_demo_visitor_2026` works end-to-end via Claude Desktop config.
- [ ] Once merged, cross-link from `app.tenantiq.app/compare` and the next blog post.
- [ ] Update `.luna/tenantiq/strategy/2026-05-06_autonomous_viral_roadmap.md` Tier-A move 1 status.
