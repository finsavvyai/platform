# FinsavvyAI Platform

Shared services for the FinsavvyAI ecosystem.

Mission: infrastructure for autonomous AI software systems.

## Packages

| Package | Role |
|---|---|
| `@finsavvyai/auth` | OAuth, JWT, MFA, SAML, SCIM, RBAC |
| `@finsavvyai/billing` | LemonSqueezy, subscriptions, entitlements |
| `@finsavvyai/telemetry` | OpenTelemetry, traces, replay, AI exec logs |
| `@finsavvyai/policy-engine` | PipeWarden OSS, governance, PR rules |
| `@finsavvyai/ai-gateway` | Provider routing, retries, semantic cache, model selection |

## Consumers

- PushCI — trust AI-generated code
- Qestro — trust AI-generated apps
- LunaOS — operate AI engineering workflows
- OpenSyber — secure AI runtime execution
- SDLC.cc — govern AI software delivery
- AMLIQ — AI-native AML investigations

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Rules

- TS strict, 200-line file cap, 90% line / 85% branch coverage.
- 100% coverage for critical paths (auth, billing writes, policy decisions).
- No critical/high vulns at release.
- Audit logs for auth events, admin actions, sensitive mutations.
