# Quick Wins — amliq-frontend
**< 1 hour each**

---

## 1. flakestress in CI (15 min)

Add to `.github/workflows/ci.yml` or equivalent:

```yaml
- name: Flaky test stress
  run: npx playwright test --repeat-each=5 --workers=4
```

No new deps. Uses existing Playwright config. Catches ordering-dependent failures immediately.

---

## 2. Perfetto Performance Mark (20 min)

Add User Timing marks to batch screening — zero deps, native browser API:

```ts
// src/features/screening/BatchScreening.tsx
performance.mark('batch-screen:start')
// ... after results load:
performance.measure('batch-screen:total', 'batch-screen:start')
```

Then open Chrome DevTools → Performance → see traces. Costs nothing, reveals render bottlenecks instantly.

---

## 3. Web Vitals CI Gate (30 min)

Install `web-vitals` (already likely in deps or trivial to add):

```bash
npm i web-vitals
```

```ts
// src/main.tsx
import { onLCP, onCLS, onINP } from 'web-vitals'
onLCP(console.log)
onCLS(console.log)
onINP(console.log)
```

Emit to console in dev, to analytics endpoint in prod. Instant perf visibility with no infrastructure.

---

## 4. any-llm Proof of Concept — superseded 2026-05-03

The original FastAPI sidecar (`ai_proxy.py`, archived at
`.archive/ai_proxy.py`) has been replaced by the production aegis
backend at `POST /api/v1/ai/summarize`. The frontend already calls
the production contract via `src/api/ai.ts`. See `.archive/README.md`
for the migration trail.

Aegis backend adds: JWT auth, MaskAML DLP scrub (PII + PAN + IBAN +
BIC + Israeli ID), tamper-evident audit log, optional Bedrock backend
for data-residency pilots. Run `aegis` instead of standing up the
sidecar.

---

## 5. Browser-native Speech (10 min, zero deps)

Before integrating Voicebox, validate demand with the Web Speech API:

```tsx
// Temporary dictation button
const recognition = new (window as any).SpeechRecognition()
recognition.onresult = (e) => setNote(e.results[0][0].transcript)
recognition.start()
```

Ships in Chrome/Edge/Safari. No bundle size cost. If analysts use it, invest in Voicebox for privacy/offline.
