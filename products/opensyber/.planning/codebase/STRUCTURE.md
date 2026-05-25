# Structure

Top-level layout (high signal). See also root `CLAUDE.md` “Code Map & Index” for extended detail.

```
opensyber/
├── apps/
│   ├── api/                 # Main Cloudflare Worker API (Hono)
│   ├── web/                 # Next.js customer + dashboard UI
│   ├── agent/               # Node daemon (monitoring, skills)
│   ├── claw-gateway/        # CF Worker AI gateway
│   ├── tokenforge-api/      # TokenForge API Worker
│   ├── tokenforge-web/      # TokenForge Next.js app
│   ├── tokenforge-proxy/    # TokenForge edge proxy Worker
│   └── redirects/           # Redirect Worker (if present)
├── packages/
│   ├── auth/                # Auth.js helpers
│   ├── db/                  # Drizzle schema + D1 migrations
│   ├── shared/              # Types, constants, utils
│   ├── tokenforge/          # TokenForge SDK
│   ├── tokenforge-sdks/     # Go, Python, Swift, MCP, etc.
│   ├── ui/                  # Shared React components
│   ├── claw-sdk/            # Gateway client SDK
│   ├── skill-sdk/           # Skill authoring SDK
│   ├── cli/                 # CLI
│   ├── opensyber-mcp/       # MCP server package
│   └── vscode-extension/    # VS Code extension
├── skills/                  # Marketplace skill implementations (AI skills, bundles)
├── docs/                    # Product & technical documentation
├── deploy/                  # Deployment helpers
├── scripts/                 # Repo scripts
├── samples/                 # Sample projects (workspace member)
├── tests/                   # Cross-cutting tests / sample projects
├── tokenforge/              # Additional TokenForge-related assets (if present)
└── .luna/                   # Luna / sprint artifacts (not core runtime)
```

## Key file locations

| Concern | Path |
|--------|------|
| API entry | `apps/api/src/index.ts` |
| API route table | `apps/api/src/routes/register.ts` |
| API middleware | `apps/api/src/middleware/` |
| API services | `apps/api/src/services/` |
| Worker config | `apps/api/wrangler.toml` |
| Web App Router | `apps/web/src/app/` |
| Web components | `apps/web/src/components/` |
| Web e2e tests | `apps/web/e2e/` |
| Playwright config | `apps/web/playwright.config.ts` |
| Drizzle schema | `packages/db/src/schema/` |
| SQL migrations | `packages/db/migrations/` |
| Shared types | `packages/shared/src/types/` |

## Naming conventions

- **Packages** — Scoped npm names `@opensyber/*` (see individual `package.json` `name` fields).
- **API routes** — Hono route modules under `apps/api/src/routes/` often grouped by domain (`*-routes.ts` or folder per area).
- **Tests** — Co-located `*.test.ts` in API (`apps/api/src/test/`, route-adjacent tests e.g. `health.test.ts`); Vitest configs at package roots (`apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`).

## Generated / local artifacts (typical)

- **Next.js** — `apps/web/.next/` (gitignored).
- **Turbo** — `.turbo/` cache.
- **Wrangler** — `.wrangler/` under apps using Workers.

---
*Generated for GSD codebase map — focus: structure*
