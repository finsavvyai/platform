# Quick Wins — Under 1 Hour Each

## 1. flakestress — Detect Flaky Tests (30 min)

```bash
go install github.com/bradfitz/flakestress@latest
flakestress -n 50 ./internal/screening/...
flakestress -n 50 ./internal/storage/pgx/...
```

Add to Makefile:
```makefile
test-flaky:
	flakestress -n 50 ./internal/screening/...
	flakestress -n 50 ./internal/storage/pgx/...
```

**Why now**: 343 test files. Flaky tests erode CI trust. Find them before they bite.

---

## 2. Perfetto Trace Export Endpoint (45 min)

Add a `/debug/perf` admin endpoint that dumps the existing internal pipeline metrics as a Perfetto-compatible JSON trace:

```go
// api/handler_debug_perf.go
func (h *Handler) HandleDebugPerf(w http.ResponseWriter, r *http.Request) {
    metrics := h.engine.GetPipelineMetrics()
    trace := convertToPerf(metrics)
    json.NewEncoder(w).Encode(trace)
}
```

**Why now**: Internal metrics already exist. Exposing them in Perfetto format gives you a free APM dashboard via `ui.perfetto.dev`.

---

## 3. llamafile Dev Setup (30 min)

Download a small model for local dev/testing:

```bash
# Download Mistral 7B llamafile
curl -LO https://huggingface.co/Mozilla/Mistral-7B-Instruct-v0.2-llamafile/resolve/main/mistral-7b-instruct-v0.2.Q4_0.llamafile
chmod +x mistral-7b-instruct-v0.2.Q4_0.llamafile
```

Add to docker-compose for dev:
```yaml
llamafile:
  image: mozilla/llamafile
  ports:
    - "8081:8080"
```

Set `LLM_BASE_URL=http://localhost:8081/v1` in dev `.env`. The existing OpenAI-compatible client in `engine_llm.go` works out of the box.

**Why now**: Free local LLM for development. Stop burning Anthropic credits during testing.

---

## 4. Tailscale for Dev Database (20 min)

```bash
# Install
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Share PostgreSQL only over Tailscale
# In docker-compose, remove ports: from postgres service
# Access via tailscale IP instead
```

**Why now**: Stop exposing dev database ports. Zero-config, no VPN management.

---

## 5. Victory Chart Evaluation (15 min)

Install and render one chart to compare against Recharts:

```bash
cd web && npm install victory
```

Create a test component comparing the same data in both libraries. Check bundle size delta, animation quality, and accessibility (ARIA labels on chart elements).

**Why now**: Low-risk evaluation. If Victory is better, plan migration. If not, delete and move on.
