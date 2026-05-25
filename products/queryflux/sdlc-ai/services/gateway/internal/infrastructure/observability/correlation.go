package observability

import "context"

// CorrelationContext holds request correlation information
type CorrelationContext struct {
	RequestID     string
	TraceID       string
	SpanID        string
	UserID        string
	TenantID      string
	SessionID     string
	CorrelationID string
}

// GetCorrelationContext extracts correlation info from context
func GetCorrelationContext(ctx context.Context) CorrelationContext {
	// Extract from context values if available
	return CorrelationContext{}
}
