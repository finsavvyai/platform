# OpenSyber

### Your AI agents have root access. You have 340 milliseconds.

That's how long it takes us to detect an AI agent exfiltrating your `.env` and block it. The industry average? **197 days.**

We built OpenSyber after our own agent got compromised. A prompt injection in a third-party dependency turned a code reviewer into a data exfiltration pipeline. It ran for **6 days** before anyone noticed. Datadog didn't catch it. Sentry didn't catch it. CloudWatch didn't catch it. None of them understood what an AI agent *should* be doing.

Now they don't have to. We do.

---

## What We Build

### [OpenSyber](https://opensyber.cloud) — AI Agent Runtime Security

The monitoring and security platform that traditional tools can't provide.

| Capability | What It Does |
|-----------|-------------|
| **Behavioral Baselines** | Knows what your agent *should* do. Catches deviations in milliseconds. |
| **Credential Vault** | Agents never see raw secrets. Skill-level access controls. Auto-rotation on breach. |
| **Skill Marketplace** | 22 audited skills. Signature verification. Supply chain scanning. |
| **Network Isolation** | Agents only talk to approved endpoints. Exfiltration blocked before TCP handshake. |
| **Security Scoring** | 8-category scoring. Attack surface visualization. Real-time event stream. |
| **60-Second Deploy** | Hetzner VMs with Docker isolation, seccomp, osquery. Secure by default. |

### [TokenForge](https://tokenforge.opensyber.cloud) — Device-Bound Session Security

Session tokens get stolen. We made stolen tokens **mathematically useless**.

ECDSA P-256 signatures with non-extractable keys via Web Crypto API. Even if an attacker has the token, it won't work on their device. Period.

**SDKs:** TypeScript / Go / Python / Kotlin / Swift / React Native
**Adapters:** Express / Fastify / Hono / Next.js

---

## The Numbers

```
 340ms    Time to detect + block + rotate credentials
  96%    Test coverage (Vitest + Playwright)
  118    API routes (Hono + Cloudflare Workers)
   22    Audited skills in marketplace
    6    SDK languages for TokenForge
   23    Database tables (Drizzle + D1)
    0    Other platforms built for AI agent runtime security
```

## Architecture

```
opensyber/                          Turborepo + pnpm monorepo
├── apps/
│   ├── api                         Hono + CF Workers — 118 routes
│   ├── web                         Next.js 16 — dashboard + landing
│   ├── agent                       Node.js daemon — runs in user containers
│   ├── tokenforge-api              TokenForge verification API
│   └── tokenforge-web              TokenForge product site
├── packages/
│   ├── tokenforge                  SDK: client + server + adapters
│   ├── tokenforge-sdks             Go, Python, Kotlin, Swift, React Native
│   ├── db                          Drizzle ORM + D1 migrations
│   ├── shared                      Types, constants, plan configs
│   └── ui                          React component library
```

## Quick Start

```bash
git clone https://github.com/finsavvyai/opensyber.git && cd opensyber
pnpm install && pnpm dev
```

## Status

**Production.** 97% feature complete. Currently building Enterprise RBAC + Teams (Sprint 8).

Next: SAML/OIDC SSO, audit logs, SOC 2 Type II (target Q3 2026).

---

**Built by people who got breached first.**

MIT License
