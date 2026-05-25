// Package analytics carries product-funnel events from the API
// surface to a downstream sink (PostHog-compatible HTTP endpoint
// in prod, stderr in dev). Backend-only — frontend emits its own
// events (`billing.checkout_started`, etc.) directly to the same
// sink so the funnel stays end-to-end queryable.
package analytics

import "time"

// Standard event names. Keep this list small; add a new entry only
// when there's a downstream dashboard query that needs it.
const (
	EventAuthSignup       = "auth.signup"
	EventAuthLogin        = "auth.login"
	EventScreenExecuted   = "screen.executed"
	EventScreenFirst      = "screen.first"
	EventUsageExhausted   = "usage.exhausted"
	EventCheckoutStarted  = "billing.checkout_started"
)

// Event is one funnel observation. distinct_id is the stable
// identity the downstream tool uses to join events into journeys —
// tenant_id is the right level for B2B SaaS (one analyst's funnel
// is the org's funnel).
type Event struct {
	Name       string                 `json:"event"`
	DistinctID string                 `json:"distinct_id"`
	Timestamp  time.Time              `json:"timestamp"`
	Properties map[string]interface{} `json:"properties,omitempty"`
}

// Sink swallows events for delivery to an external analytics
// service. Implementations must be safe for concurrent use because
// the handlers fan out emits in goroutines.
type Sink interface {
	Emit(ev Event)
}
