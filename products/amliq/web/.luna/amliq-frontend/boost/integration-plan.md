# Integration Plan — amliq-frontend

**Date:** 2026-04-21
**Priority:** Business impact × implementation effort

---

## Phase 1 — Quick Reliability (Week 1)

### 1.1 flakestress — CI Flaky Test Guard
**Repo:** https://github.com/bradfitz/flakestress

```bash
# Add to CI (GitHub Actions / Cloudflare CI)
go install github.com/bradfitz/flakestress@latest
flakestress -count=10 ./...
```

Add as a separate CI job that runs Playwright suite 10× in parallel. Block merge on flake rate > 2%.

---

## Phase 2 — Performance Visibility (Week 1–2)

### 2.1 Perfetto — Render + API Trace
**Repo:** https://github.com/google/perfetto

**Frontend integration:**
```ts
// Use Performance Observer API to emit traces
// Send to perfetto trace_processor or self-hosted UI
import { createPerfettoTrace } from './lib/perfetto'

// Instrument heavy routes: /screening/batch, /alerts, /analytics
```

**Steps:**
1. Add `perfetto` npm package for trace capture.
2. Instrument `useEffect` in batch screening and analytics pages.
3. Export traces to `.proto` format; pipe into Perfetto UI for analysis.
4. Add perf budget gate: fail CI if LCP > 2.5s on analytics route.

---

## Phase 3 — AI-Assisted Triage (Week 2–4)

### 3.1 RuVector — Entity Hybrid Search
**Repo:** https://github.com/ruvnet/RuVector

**Architecture:**
```
Frontend screening form
    → POST /api/screen
    → RuVector sidecar (vector + keyword hybrid)
    → Returns: ranked entity matches + graph neighbors
    → Frontend renders match cards with confidence scores
```

**Steps:**
1. Deploy RuVector as Docker sidecar next to API.
2. Ingest sanctions + PEP lists into RuVector on startup.
3. Replace current string-match screening with RuVector hybrid query.
4. Add "Similar Cases" panel on case detail page using graph RAG.

### 3.2 any-llm — Alert Summarization
**Repo:** https://github.com/mozilla-ai/any-llm**

**Backend proxy (Python FastAPI):**
```python
from any_llm import LLM

llm = LLM(provider="anthropic", model="claude-haiku-4-5")

async def summarize_alert(alert_data: dict) -> str:
    return await llm.complete(
        f"Summarize this AML alert for a compliance officer: {alert_data}"
    )
```

**Frontend:**
```ts
// AlertDetail.tsx — add AI summary panel
const { data: summary } = useQuery(['alert-summary', alertId], 
  () => api.get(`/alerts/${alertId}/ai-summary`)
)
```

**Steps:**
1. Add FastAPI summarization proxy.
2. Wire `any-llm` with Claude Haiku (cost-efficient for summaries).
3. Add "AI Summary" collapsible panel to `AlertDetail` component.
4. Cache summaries server-side; don't re-generate on each view.

---

## Phase 4 — Voice Case Notes (Week 4–6)

### 4.1 Voicebox — Speech-to-Text for Case Notes
**Repo:** https://github.com/jamiepine/voicebox**

```tsx
// CaseNoteInput.tsx
import { useVoicebox } from './hooks/useVoicebox'

const { isRecording, transcript, start, stop } = useVoicebox({ lang: 'en' })

return (
  <div>
    <textarea value={transcript} onChange={...} />
    <button onClick={isRecording ? stop : start}>
      {isRecording ? 'Stop' : 'Dictate'}
    </button>
  </div>
)
```

**Steps:**
1. Bundle Voicebox WASM binary — runs fully local, no audio leaves browser.
2. Add `useDictation` hook wrapping Voicebox.
3. Add mic button to case note textarea.
4. Respect i18n locale for language selection.

---

## Phase 5 — Offline AI (Future / Optional)

### 5.1 llamafile — Air-gapped Compliance Mode
**Repo:** https://github.com/mozilla-ai/llamafile

For enterprise customers in restricted environments:
1. Bundle `Mistral-7B.llamafile` as downloadable binary.
2. Replace `any-llm` Anthropic provider with local llamafile endpoint.
3. Frontend detects `VITE_OFFLINE_MODE=true` and switches endpoint.

---

## Success Metrics

| Integration | KPI |
|------------|-----|
| flakestress | Flake rate < 2% in CI |
| Perfetto | LCP < 2.5s analytics, < 1.5s screening |
| RuVector | Entity match accuracy > baseline string search |
| any-llm | Alert review time reduced (measure via session analytics) |
| Voicebox | Case note creation time reduced |
