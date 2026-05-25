package audit

import (
	"context"
	"log"
	"strings"
	"time"
)

// RecordAIRequest persists one observability row per AI provider call.
// Failures are logged and dropped — observability must never break
// the request path. nil repo = silent no-op for dev/no-DB runs.
//
// Public so consumers (sdlc-cc binary, aegis handlers, future clients)
// can call it from their own request paths after a Provider.Complete.
func RecordAIRequest(repo Repository, row AIRequestLog) {
	if repo == nil {
		return
	}
	if err := repo.Create(context.Background(), row); err != nil {
		log.Printf("ai_request_log: write failed (best-effort): %v", err)
	}
}

// BuildSuccessLog assembles the row for a successful provider call.
// Token counts are estimates from the prompt + response; real upstream
// usage isn't surfaced through Provider today (4-chars-per-token
// heuristic — honest fidelity over fake precision).
func BuildSuccessLog(tenantID, actorID, provider, model, summaryType, prompt, response string, latency time.Duration, cached bool) AIRequestLog {
	pTok := estimateTokens(prompt)
	cTok := estimateTokens(response)
	cost := EstimateCostMicros(model, pTok, cTok)
	if cached {
		zero := int64(0)
		cost = &zero
	}
	return AIRequestLog{
		TenantID: tenantID, ActorID: actorID,
		Provider: provider, Model: model,
		SummaryType:      summaryType,
		PromptTokens:     &pTok,
		CompletionTokens: &cTok,
		LatencyMs:        int(latency.Milliseconds()),
		Status:           "ok",
		CostUSDMicros:    cost,
		Cached:           cached,
	}
}

// BuildErrorLog assembles the row for a failed provider call. Token
// counts may still be set from the prompt (estimated before the
// call); response is empty so completion_tokens=0.
func BuildErrorLog(tenantID, actorID, provider, model, summaryType, prompt, errCode string, latency time.Duration) AIRequestLog {
	pTok := estimateTokens(prompt)
	zero := 0
	return AIRequestLog{
		TenantID: tenantID, ActorID: actorID,
		Provider: provider, Model: model,
		SummaryType:      summaryType,
		PromptTokens:     &pTok,
		CompletionTokens: &zero,
		LatencyMs:        int(latency.Milliseconds()),
		Status:           "error",
		ErrorCode:        errCode,
	}
}

// ClassifyError maps a provider error string to a coarse code so
// dashboards can aggregate without needing free-text search.
func ClassifyError(err error) string {
	if err == nil {
		return ""
	}
	s := strings.ToLower(err.Error())
	switch {
	case strings.Contains(s, "timeout") || strings.Contains(s, "deadline"):
		return "TIMEOUT"
	case strings.Contains(s, "503") || strings.Contains(s, "502"):
		return "UPSTREAM_5XX"
	case strings.Contains(s, "429"):
		return "UPSTREAM_RATE_LIMITED"
	case strings.Contains(s, "401") || strings.Contains(s, "403"):
		return "AUTH"
	case strings.Contains(s, "fallback exhausted"):
		return "ALL_PROVIDERS_FAILED"
	default:
		return "UNKNOWN"
	}
}

// estimateTokens — internal helper, also used by cost.go.
// 4 chars ≈ 1 token (OpenAI cookbook approximation).
func estimateTokens(s string) int { return (len(s) + 3) / 4 }
