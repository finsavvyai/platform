# Fix 02 — Cross-project contamination: OpenSyber leaked into Qestro defaults

**Severity**: HIGH (wrong product branding shown to Qestro users; triggers `503` on `/api/visual/baselines/proj-opensyber`).

## Detection

Iteration 2 logged 6× HTTP 503 to `http://localhost:8000/api/visual/baselines/proj-opensyber`. The frontend was calling the visual-baselines endpoint with a project ID that belongs to a different product entirely (`opensyber.cloud` is a separate runtime-security app the user maintains).

Tracing the call: `frontend/src/contexts/ProjectContext.tsx:34` listed `{ id: 'proj-opensyber', name: 'OpenSyber' }` as the FIRST entry in `MOCK_PROJECTS`, so any user without a saved `lastActiveProjectId` defaulted to OpenSyber. The visual-regression page then fetched baselines for that project, the backend service threw, returned 503.

## Files changed

1. `frontend/src/contexts/ProjectContext.tsx` — removed OpenSyber entry, promoted `Qestro Platform` to first/default.
2. `backend/src/routes/projects.route.ts:42` — fallback list now returns Qestro, not OpenSyber.
3. `backend/src/routes/projects.mock.routes.ts:22` — `projectStore` seeded with Qestro entry, not OpenSyber.
4. `backend/src/routes/test-cases.mock.routes.ts:218` — default `targetUrl` now `https://qestro.app` instead of `https://opensyber.cloud`.

## Expected effect

- `/api/visual/baselines/...` no longer called with `proj-opensyber`; the 6× 503s should disappear.
- New users land on `Qestro Platform` as their default project.
- Mock test-case runs report `qestro.app` as target URL.

## Out of scope (followups)

- The visual-regression Express handler still throws on unknown projects — `backend/src/routes/visual-regression.routes.ts:127` should map "not found" to 404 not 503. Not fixed here because the call site no longer exercises it; surfaces as a backend hardening task instead.
- `backend/src/routes/ai-chat.ts:12` contains a header comment "Ported from opensyber's ai-chat.ts" — left in place as historical attribution, not user-visible.
