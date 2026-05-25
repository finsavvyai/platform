package ai

// GemmaAdapter wraps *GemmaClient to satisfy the Provider interface
// the FallbackChain expects. Non-invasive — leaves the existing
// GemmaClient methods alone so other callers (orchestrator, agent)
// keep working.
//
// One GemmaClient already routes to DeepSeek / Groq / Gemini /
// OpenRouter / Ollama (env-driven priority). Wrapping it as a single
// Provider link in the chain means setting any of those env vars
// turns on a fallback target without code changes — that's the
// "self-hostable, no AWS lock-in, multi-cloud" wedge in one type.
type GemmaAdapter struct {
	*GemmaClient
}

// NewGemmaAdapter constructs the adapter, returning nil when no
// underlying provider is configured (so FallbackChain's auto-filter
// drops it cleanly instead of carrying a dead link).
func NewGemmaAdapter() *GemmaAdapter {
	c := NewGemmaClient()
	if c == nil {
		return nil
	}
	return &GemmaAdapter{c}
}

// IsConfigured satisfies Provider. GemmaClient calls this IsAvailable
// and additionally pings the daemon for local mode; we only check
// the cheap part here so the chain doesn't pay an HTTP-roundtrip
// cost on every Complete attempt.
func (a *GemmaAdapter) IsConfigured() bool {
	if a == nil || a.GemmaClient == nil {
		return false
	}
	if a.IsLocal() {
		// For local Ollama, we trust that the deploy wired it up;
		// IsAvailable() actually pings, which is too expensive for
		// the per-request hot path. Trust + handle errors via the
		// chain's transient-error fallthrough.
		return true
	}
	return a.apiKey != ""
}

// Name satisfies Provider. Forwards to the inner GemmaClient's
// Provider() method which returns the active backend name
// ("deepseek", "groq", "gemini", "openrouter", "ollama").
func (a *GemmaAdapter) Name() string {
	if a == nil || a.GemmaClient == nil {
		return "gemma-unconfigured"
	}
	return a.Provider()
}
