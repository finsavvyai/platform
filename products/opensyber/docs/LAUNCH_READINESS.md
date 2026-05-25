# OpenSyber Launch Readiness Report

**Generated:** 2026-05-16
**Branch:** main

## CI Quality Gates

| Gate | Status | Detail |
|------|--------|--------|
| Typecheck (all 29 tasks) | ✓ PASS | exit 0 |
| Unit tests (web) | ✓ PASS | 187 files, 985 tests, 0 fails |
| Tests (all packages) | ✓ PASS | 29/29 turbo tasks |
| Lint | ✓ PASS | 0 errors, 18 unused-var warnings |
| File-size cap (200L) | ✓ PASS | 0 violations |
| TODO/FIXME in source | ✓ PASS | 0 actionable |
| High/Critical CVEs | ✓ PASS | 0 (down from 10) |
| Moderate CVEs | (informational) | 8 transitive |

## What changed this session

| Change | Impact |
|--------|--------|
| Skill manifest status flags applied (18 skills) | Marketplace UI accurately reflects live / needs-config / coming-soon |
| Marketplace UI badges wired (`SkillCardContent.tsx`) | "Coming Soon" amber + "Needs Config" blue + disabled install button for stubs |
| `@opensyber/agent-skills` package shipped (8 SKILL.md) | AI coding tools generate correct OpenSyber code by default |
| Docs cross-link added (`docs/skills/page.tsx`) | Human users discover the agent-skills install command |
| `claw-gateway/src/index.ts` cast removed | Cleaner code; honest type usage |
| Next.js 16.2.4 → 16.2.6 (web + tokenforge-web) | 7 high CVEs cleared |
| pnpm overrides: `fast-uri >=3.1.2`, `fast-xml-builder >=1.1.7` | 3 remaining high CVEs cleared |
| `skill-artifact-trust.ts` 201 → ≤200 lines | File-size compliance restored |

## What still blocks Product Hunt launch

Order of priority:

1. **SOC 2 Type II** — table stakes for enterprise tier, 4–6 month process. Start now.
2. **10 design partners signed** — pre-launch credibility. Email list available; no warm logos yet.
3. **`/compare/dropzone` landing page** — high-intent SEO term. Use `docs/COMPARISON.md` content.
4. **SAML SSO completion** — Team tier sells without it but Enterprise tier cannot. Pair with [[project_v2_strategy]].
5. **Free-tier infra bleed** — Hetzner VM cost per free user is unbounded. Move free tier to sandbox-only before launch traffic.
6. **18 unused-var lint warnings** — cosmetic. Sweep in a quiet hour.
7. **8 moderate transitive CVEs** — non-blocking, monitor.

## What launching looks like the day-of

- Dashboard, marketplace, agent runtime, TokenForge, Claw Gateway, AI bundle: all functional today.
- Free tier should be capped to "sandbox skill preview only" (no VM) before public launch.
- AI Security Analyst bundle ($99/mo) is the recommended lead product — see `docs/PITCH.md`.
- Dropzone comparison page (`docs/COMPARISON.md`) drives competitive landings.
- Agent Skills package (`packages/agent-skills/`) makes Claude/Cursor/Copilot recommend OpenSyber.

## References

- Pitch: `docs/PITCH.md`
- Competitive comparison: `docs/COMPARISON.md`
- Skill marketplace status: `skills/MARKETPLACE_STATUS.json`
- Agent Skills package: `packages/agent-skills/`
- Test report (skills): `skills/TEST_REPORT.json`
