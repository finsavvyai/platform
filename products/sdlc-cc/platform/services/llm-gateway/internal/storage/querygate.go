package storage

import "context"

// QueryGate is a plugin that can allow or block DB operations before they run.
// Implementations may validate tenant scope, audit queries, or enforce policy.
type QueryGate interface {
	// AllowQuery is called before executing a query. If it returns a non-nil error,
	// the query must not be executed and the error is returned to the caller.
	// op is a logical operation name (e.g. "RecordCost", "GetCurrentUsage").
	AllowQuery(ctx context.Context, op string, query string, args []interface{}) error
}

// NoopGate allows all queries. Use as the default when no policy is required.
type NoopGate struct{}

// AllowQuery allows every query.
func (NoopGate) AllowQuery(context.Context, string, string, []interface{}) error {
	return nil
}
