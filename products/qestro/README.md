# Qestro

> The copilot for testing AI vibe coding. Write tests once, run everywhere.

[![Status](https://img.shields.io/badge/Status-Early%20Access-green.svg)](https://qestro.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Qestro?

Developers ship fast with AI — Cursor, Copilot, vibe coding. But who tests what they ship?

Qestro is the testing copilot. Paste a URL, describe what to test in plain English, and get production-ready test cases that run across browser, mobile, and API. Self-healing assertions mean your tests fix themselves when your UI changes. No more flaky tests, no more maintenance hell.

**One platform. Three targets. Zero boilerplate.**

- **Browser** — Playwright under the hood, cross-browser (Chrome, Firefox, Safari)
- **Mobile** — iOS and Android via Maestro integration
- **API** — REST and GraphQL with chaining, auth, and assertions

## Quick Start

```bash
npm install
docker-compose up          # Postgres + Redis
npm run dev                # Frontend + Backend + Orchestrator
```

Or visit [qestro.app](https://qestro.app) to use the hosted version.

## How It Works

1. **Describe** — Paste a URL or API endpoint, describe what to test in plain English
2. **Generate** — AI creates Playwright/Maestro test code with smart assertions
3. **Run** — Execute across browser, mobile, or API from one dashboard
4. **Self-Heal** — When selectors change, Qestro detects and fixes automatically
5. **Report** — Results, screenshots, trends, and CI/CD integration

## Architecture

```
qestro/
├── frontend/              # Vite + React + TypeScript (qestro.app)
├── backend/               # Cloudflare Workers + Hono (api.qestro.app)
│   ├── routes/            # REST API endpoints
│   ├── services/          # Business logic (runners, healing, analytics)
│   ├── auth/              # JWT + OAuth (GitHub, Microsoft, Google)
│   └── db/                # Drizzle ORM + D1
├── orchestrator/          # Test execution engine
│   ├── runners/           # Playwright, Maestro, API runners
│   ├── generators/        # LLM test generation
│   └── healers/           # Self-healing assertion engine
├── cli/                   # Command-line tool
├── shared/                # Types, config, utilities
├── tests/                 # E2E Playwright tests
└── drizzle/               # Database schema + migrations
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite, React 19, TypeScript, Tailwind CSS |
| Backend | Cloudflare Workers, Hono, Drizzle ORM |
| Database | Cloudflare D1 (SQLite) |
| Auth | JWT + OAuth (GitHub, Microsoft, Google) |
| Test Runners | Playwright, Maestro, Axios |
| AI | Multi-provider LLM (Claude, GPT-4) |
| CI/CD | GitHub Actions, GitLab CI |
| Deployment | Cloudflare Pages + Workers |

## Core Features (April 2026)

**Shipped:**
- Real Playwright test runner (Chromium/Firefox/WebKit)
- API test runner (REST/GraphQL with chaining and auth)
- AI-powered self-healing engine (selector, timing, assertion healers)
- CI/CD integration (GitHub Actions + GitLab CI webhooks)
- Analytics engine (trends, flakiness detection, slowest tests)
- Report generator (JUnit XML, HTML, Allure, JSON, CSV)
- Test scheduler (cron-based, parallel sharding)
- 57 production test cases for OpenSyber.cloud

**Coming:**
- Visual regression (pixel-perfect screenshot diff)
- Full Maestro mobile integration
- SSO/SAML (Azure AD, Okta)
- Plugin marketplace

## Development

```bash
# Install
npm install

# Dev (all services)
npm run dev

# Frontend only
cd frontend && npm run dev

# Backend (Cloudflare Worker)
cd backend && npx wrangler dev

# Tests
npm test                    # Unit tests
npx playwright test         # E2E tests

# Deploy
cd backend && npx wrangler deploy                              # API
cd frontend && npx wrangler pages deploy dist --project-name=questro-frontend  # App
```

## Pricing

| | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Projects | 5 | 50 | 500 | Unlimited |
| Runs/month | 100 | 5,000 | 50,000 | Unlimited |
| Price | $0 | $99/mo | $499/mo | Custom |
| Platforms | Browser | Browser + API | All | All + on-prem |
| Self-healing | Basic | Full | Full | Full + custom |
| CI/CD | — | GitHub | All | All + custom |

## Links

- **App**: [qestro.app](https://qestro.app)
- **API**: [api.qestro.app](https://api.qestro.app)
- **Marketing**: [qestro.io](https://qestro.io)

---

**Built for developers who ship fast and test smart.**
