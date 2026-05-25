# Development Guide — LunaOS Studio

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | `nvm install 20` |
| npm | ≥ 10 | Bundled with Node |
| Git | any | `brew install git` |

## Setup

```bash
git clone https://github.com/lunaos/lunaos-studio.git
cd lunaos-studio
npm install
cp .env.example .env.local   # fill in your values
npm run dev                  # http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Engine API base URL (default: `https://api.lunaos.ai`) |
| `VITE_SENTRY_DSN` | No | Sentry error tracking DSN |
| `VITE_DATADOG_APP_ID` | No | DataDog RUM application ID |
| `VITE_DATADOG_CLIENT_TOKEN` | No | DataDog RUM client token |
| `VITE_ENABLE_ANALYTICS` | No | `true` to enable analytics (default: `false`) |
| `VITE_LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` |

## Project Structure

```
src/
  components/     React UI components (≤ 100 lines each)
  hooks/          Custom React hooks
  lib/            Core business logic (no React)
  types/          TypeScript interfaces
  __tests__/      Unit tests (co-located)
config/           Environment-specific configuration
monitoring/       DataDog dashboards & alert definitions
scripts/          Deployment & health-check shell scripts
tests/
  unit/           Additional unit tests
  e2e/            Playwright end-to-end tests
  integration/    Integration tests
```

## Code Style

- **TypeScript strict mode** — no `any` types.
- Max **200 lines per file**; max **100 lines per React component**.
- ESLint + Prettier: `npm run lint:fix` before committing.
- No `console.log` in production paths — use structured logging.
- `const` preferred; never `var`.

## Git Workflow

```
main          — production-ready, protected
feature/xxx   — new features
fix/xxx       — bug fixes
chore/xxx     — tooling, deps, CI
```

Commit format: `feat:`, `fix:`, `chore:`, `docs:`, `test:` (conventional commits).

## Running Tests

```bash
npm test                   # all unit tests
npm run test:coverage      # with coverage report
npm run test:e2e           # Playwright E2E
npm run test:visual        # visual regression
npm run lighthouse         # Lighthouse CI
```

Coverage thresholds: **80% branches, lines, functions, statements**.

## Debugging

Enable verbose logging:
```bash
VITE_LOG_LEVEL=debug npm run dev
```

React DevTools: install the browser extension.
Redux/Zustand DevTools: open browser DevTools → "Components" tab.

## Common Issues

| Problem | Solution |
|---------|----------|
| `Module not found` errors | Run `npm install` |
| Tests fail with JSDOM errors | Check `jest.config.js` testEnvironment |
| Vite HMR not working | Restart dev server; check `vite.config.js` |
| CSP blocks local API calls | Add `localhost` to `connect-src` in dev config |
