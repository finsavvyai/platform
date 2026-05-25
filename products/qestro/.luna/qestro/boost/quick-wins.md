# Qestro — Quick Wins (Under 1 Hour Each)

**Date**: 2026-04-10

---

### 1. Add llamafile dev instructions to README (15 min)
Document how to run AI test generation offline:
```bash
# Download TinyLlama llamafile
curl -L -o tinyllama.llamafile https://huggingface.co/Mozilla/TinyLlama-1.1B-Chat-v1.0-llamafile/resolve/main/TinyLlama-1.1B-Chat-v1.0.Q5_K_M.llamafile
chmod +x tinyllama.llamafile
./tinyllama.llamafile --port 8080

# Set in .env
LOCAL_LLM_URL=http://localhost:8080/v1
```
No code changes needed — AIProviderClient already has the stub pattern.

---

### 2. Wire flaky test card to real data (30 min)
The Analytics dashboard shows "Flaky Tests" with mock data. The `FlakyDetector.ts` service exists. Wire:
- Add `GET /api/analytics/flaky` route
- Call `FlakyDetector.detectFlaky()` with recent test runs
- Replace mock data in `AnalyticsDashboard.tsx`

---

### 3. Add Perfetto trace link to test results (20 min)
Even before full instrumentation, add a button to download Chrome DevTools trace:
```typescript
// Already captured by Playwright
const trace = await context.tracing.stop({ path: 'trace.zip' });
```
Playwright's built-in tracing outputs Perfetto-compatible traces. Just expose the download link.

---

### 4. Add "Stress Test" button to test cards (45 min)
In the test case detail view, add a button that runs the test 10 times in sequence:
```typescript
async function stressTest(testId: string, iterations = 10) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    results.push(await api.runTest(testId));
  }
  return {
    total: iterations,
    passed: results.filter(r => r.status === 'passed').length,
    flakiness: results.filter(r => r.status === 'failed').length / iterations * 100,
  };
}
```

---

### 5. Study ruflo self-learning patterns (30 min)
Read ruflo's outcome tracking patterns and compare with `self-learning.ts`:
- Does Qestro track model → task → outcome correctly?
- Is the scoring weighted properly (70% success + 20% confidence + 10% cost)?
- Are there patterns Qestro should adopt?

No code changes — just architecture review.
