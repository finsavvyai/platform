# CLAUDE.md - LunaOS Docs

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide comprehensive, searchable documentation for the LunaOS platform covering getting started guides, API reference, workflow examples, deployment guides, and troubleshooting.
- Target user: Developers evaluating, onboarding to, or building with the LunaOS platform.
- Primary jobs to be done:
  - Guide new users through installation and first workflow creation
  - Document all engine API endpoints with request/response examples
  - Provide workflow templates and use-case walkthroughs
  - Cover deployment, CI/CD setup, and infrastructure configuration
  - Maintain security and contributing guidelines

## Product-Specific Architecture Constraints

- Runtime(s): VitePress (static site generator); deployed to Cloudflare Pages at docs.lunaos.ai
- Core services: `docs/` directory contains all markdown content organized by topic:
  - `docs/getting-started/` -- installation, quickstart
  - `docs/guide/` -- conceptual guides
  - `docs/api/` -- OpenAPI reference docs
  - `docs/agents/` -- agent type documentation
  - `docs/deployment/` -- deploy and infra guides
  - `docs/guides/` -- how-to articles
  - `docs/testing/` -- test strategy docs
  - `docs/security.md` -- security policy
- Data boundaries: Static markdown files only; no database; no user data; search via VitePress built-in
- Integration boundaries: Links to engine API, dashboard, studio, and GitHub repos
- Max 200 lines per markdown file; split long guides into multi-page series
- All code examples must be tested or extracted from actual codebase

## Product-Specific Test Matrix

- Unit tests: Not applicable (static content)
- Integration tests: Link checker to verify all internal and external links resolve
- E2E/smoke tests: Lighthouse CI for performance and accessibility; pa11y-ci for WCAG compliance
- Critical path tests (must remain 100% covered):
  - All internal links resolve (no 404s)
  - All code examples parse without syntax errors
  - Navigation sidebar renders all pages
- Coverage thresholds: N/A for docs (no runtime code); link coverage 100%

## Product-Specific Security Controls

- AuthN/AuthZ model: Public site; no authentication required; no user accounts
- Secret management: No secrets; all API examples use placeholder tokens (`sk_live_EXAMPLE`)
- Input/output validation: N/A (static site, no user input)
- Audit logging requirements: N/A (static hosting logs handled by Cloudflare Pages)
- Data retention/privacy constraints: No cookies; no analytics that collect PII; Cloudflare Pages access logs only

## Product-Specific Release Checklist

- [ ] CI is green (VitePress build succeeds)
- [ ] All internal links verified (link checker passes)
- [ ] All code examples have correct syntax highlighting
- [ ] WCAG 2.1 AA accessibility check passes (pa11y-ci)
- [ ] Lighthouse performance score >= 95
- [ ] Search index generates correctly
- [ ] Rollback path verified (previous Pages deployment tagged)
- [ ] Changelog entry added for content updates

## Commands

```bash
npm run dev               # VitePress dev server at localhost:5173
npm run build             # Production build
npm run preview           # Preview production build
```

## Local Notes

- This file sets Lighthouse >= 95 for docs (stricter than root).
- This file requires link checker pass (docs-specific quality gate).
- This file does not weaken any root policy requirement.
- Docs deployed to Cloudflare Pages at docs.lunaos.ai.
