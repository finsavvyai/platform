# Project Classification — amliq-frontend

**Date:** 2026-04-21

## Stack
- **Runtime:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Framer Motion
- **Charts:** Recharts (already integrated)
- **Routing:** React Router DOM v6
- **i18n:** i18next
- **Testing:** Vitest (unit) + Playwright (E2E)

## Domain
FinTech / RegTech — AML/CFT compliance SaaS dashboard.

Screens entities (PEP, sanctions, adverse media), manages alerts and cases, tracks transactions, generates audit trails, handles batch jobs and webhooks.

## Feature Map

| Area | Status |
|------|--------|
| Entity screening | ✅ |
| Alert queue + case management | ✅ |
| Analytics dashboard (charts) | ✅ Recharts |
| Transaction monitoring | ✅ |
| Adverse media tracking | ✅ |
| Audit trails | ✅ |
| Multi-language (i18n) | ✅ |
| Dark mode | ✅ |
| Admin + billing | ✅ |
| Command palette | ✅ |
| Offline / PWA | ❌ |
| Performance monitoring | ❌ |
| Voice / speech input | ❌ |
| AI-assisted triage | ❌ |
| Hybrid search | ❌ |

## Size
- Source structure: well-modularized by feature domain
- Test suite: 50 test files (Vitest + Playwright)
