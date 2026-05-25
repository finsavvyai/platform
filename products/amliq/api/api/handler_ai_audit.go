package api

import (
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/ai"
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// writeAIAudit persists one immutable row per LLM call. Required so a
// regulator can answer "what did this analyst send to a model".
// fail-closed: a nil repo is a wiring bug, not a graceful-degrade
// scenario, so we surface it as an error to the handler.
func writeAIAudit(audit storage.AuditRepository, claims *Claims, summaryType string) error {
	if audit == nil {
		return fmt.Errorf("audit repository unavailable")
	}
	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		return err
	}
	entry, err := domain.NewAuditEntry(
		tid, domain.AuditActionAISummarized, claims.UserID,
		"ai_summary", summaryType,
	)
	if err != nil {
		return err
	}
	entry.Details["summary_type"] = summaryType
	entry.Details["model"] = aiModelTag
	return audit.Create(entry)
}

// newAnthropicSummarizer assembles the production AI provider chain.
// Default order (no Bedrock dependency required):
//
//   Anthropic  →  Gemma/Gemini/Ollama (auto-routed by env)  →  Bedrock (opt-in)
//
// One env var per provider turns it on; FallbackChain auto-filters
// unconfigured links. Each link wraps in retry (3 attempts, 250ms
// exponential backoff). Bedrock is intentionally last + opt-in —
// the substrate doesn't require AWS, supporting on-prem and non-AWS
// FIs out of the box.
//
// Active fallback target (per request) is logged via
// chain.LastUsed() into the ai_request_log so ops can see which
// backend served a given call.
func newAnthropicSummarizer() AISummarizer {
	withRetry := func(p ai.Provider) ai.Provider {
		if p == nil {
			return nil
		}
		return ai.NewRetryProvider(p, 3, 250*time.Millisecond)
	}
	return ai.NewFallbackChain(
		withRetry(ai.NewAnthropicClient()),
		withRetry(ai.NewGemmaAdapter()),
		withRetry(ai.NewBedrockClient()),
	)
}
