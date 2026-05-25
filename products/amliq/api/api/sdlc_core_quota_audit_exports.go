package api

import (
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
	"github.com/finsavvyai/sdlc-core/quota"
)

// Re-exports of the gateway quota + audit primitives from sdlc-core.
// Aegis api/ call sites kept calling lowercase helpers
// (recordAIRequest, buildSuccessLog, etc.) — these wrappers preserve
// the call-site syntax while routing to the public sdlc-core funcs.

// ───── quota ─────

type AIQuotaEnforcer = quota.AIQuotaEnforcer

var NewAIQuotaEnforcer = quota.NewAIQuotaEnforcer

// ───── audit ─────

func recordAIRequest(repo audit.Repository, row audit.AIRequestLog) {
	audit.RecordAIRequest(repo, row)
}

func buildSuccessLog(tenantID, actorID, provider, model, summaryType, prompt, response string, latency time.Duration, cached bool) audit.AIRequestLog {
	return audit.BuildSuccessLog(tenantID, actorID, provider, model,
		summaryType, prompt, response, latency, cached)
}

func buildErrorLog(tenantID, actorID, provider, model, summaryType, prompt, errCode string, latency time.Duration) audit.AIRequestLog {
	return audit.BuildErrorLog(tenantID, actorID, provider, model,
		summaryType, prompt, errCode, latency)
}

func classifyError(err error) string { return audit.ClassifyError(err) }
