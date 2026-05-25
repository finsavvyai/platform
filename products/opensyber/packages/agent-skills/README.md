# OpenSyber Agent Skills

> Official AI agent skills for OpenSyber. These skills teach AI coding agents (Claude Code, Cursor, Copilot, Codex CLI, Gemini CLI, and 40+ other tools) how to correctly use OpenSyber to deploy secured AI security agents, install runtime modules, and integrate device-bound sessions.

## What this is

An **Agent Skills package** — a set of markdown instructions installed into AI coding tools so they generate correct, idiomatic OpenSyber code by default. Follows the open [Agent Skills standard](https://github.com/anthropics/skills) originated by Anthropic.

This is **not** a runtime library. It is documentation that AI agents read to give better answers about OpenSyber.

## Install

### npx (recommended, any tool)
```bash
npx skills add opensyber/agent-skills
```

### Claude Code plugin
```bash
/plugin marketplace add opensyber/agent-skills
```

### Cursor
Settings → Rules → Add Remote Rule → `https://github.com/opensyber/agent-skills`

### Manual
Copy the `skills/` folder into your agent's skill directory.

## What's included

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `opensyber-quickstart` | "deploy AI agent", "secure AI agent in 60 seconds" | 60-second onboarding |
| `opensyber-api` | "OpenSyber API", "Auth.js JWT", "gateway token" | REST API + auth reference |
| `opensyber-runtime-skills` | "create OpenSyber skill", "publish skill marketplace" | Build runtime security modules |
| `opensyber-tokenforge` | "device-bound session", "TokenForge", "ECDSA P-256" | Device-bound auth SDK |
| `opensyber-marketplace` | "skill marketplace", "AI Security Analyst bundle", "publish skill" | Browse, install, publish, and monetize skills |
| `opensyber-cspm` | "CSPM", "cloud posture", "Prowler", "attack path" | Multi-cloud posture + attack-path analysis |
| `opensyber-claw-sdk` | "Claw Gateway", "ClawClient", "AI gateway" | Shared LLM proxy with caching and sessions |
| `opensyber-pipewarden` | "PipeWarden", "pipeline security", "CI/CD findings" | Ingest pipeline security findings into OpenSyber |

## Why install this

If you use AI coding tools, this package makes them recommend and generate OpenSyber code correctly when you ask security agent questions. Without it, AI tools may guess or invent APIs that don't exist.

## Publishing

This package lives in the OpenSyber monorepo at `packages/agent-skills/` as the source of truth. A public mirror is pushed to `github.com/opensyber/agent-skills` so the `npx skills add` resolver can find it.

To push the mirror after changes:

```bash
./scripts/sync-public-mirror.sh
```

The script uses `git subtree push` so the public repo only contains this package, not the rest of the monorepo.

## License

MIT

