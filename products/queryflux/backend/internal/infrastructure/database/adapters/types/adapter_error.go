package types

import "time"

// AdapterError represents an adapter-specific error with detailed context.
// The unexported `sentinel` field links the error to a Phase 1 sentinel
// (see errors.go) so callers can use errors.Is / errors.As.
type AdapterError struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   string                 `json:"details,omitempty"`
	Query     string                 `json:"query,omitempty"`
	Params    []interface{}          `json:"params,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Context   map[string]interface{} `json:"context,omitempty"`
	Retryable bool                   `json:"retryable"`

	// sentinel is the canonical Phase 1 error this wraps (see errors.go).
	// Unexported so JSON serialization is unchanged; access via Unwrap/Is.
	sentinel error
}

// Error implements the error interface.
func (e *AdapterError) Error() string {
	if e.Details != "" {
		return e.Message + ": " + e.Details
	}
	return e.Message
}

// NewAdapterError creates a new adapter error with current timestamp.
func NewAdapterError(code, message, details string) *AdapterError {
	return &AdapterError{
		Code:      code,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
		Context:   make(map[string]interface{}),
		Retryable: false,
	}
}

// WithQuery adds query context to the error.
func (e *AdapterError) WithQuery(query string, params ...interface{}) *AdapterError {
	e.Query = query
	e.Params = params
	return e
}

// WithContext adds an additional context key/value to the error.
func (e *AdapterError) WithContext(key string, value interface{}) *AdapterError {
	if e.Context == nil {
		e.Context = make(map[string]interface{})
	}
	e.Context[key] = value
	return e
}

// WithRetryable marks the error as retryable.
func (e *AdapterError) WithRetryable(retryable bool) *AdapterError {
	e.Retryable = retryable
	return e
}

// Adapter error code constants (string codes, distinct from sentinel errors).
const (
	ErrCodeConnectionFailed     = "CONNECTION_FAILED"
	ErrCodeConnectionLost       = "CONNECTION_LOST"
	ErrCodeConnectionTimeout    = "CONNECTION_TIMEOUT"
	ErrCodeNotConnected         = "NOT_CONNECTED"
	ErrCodeQueryExecution       = "QUERY_EXECUTION_FAILED"
	ErrCodeQueryTimeout         = "QUERY_TIMEOUT"
	ErrCodeInvalidQuery         = "INVALID_QUERY"
	ErrCodeEmptyQuery           = "EMPTY_QUERY"
	ErrCodeUnauthorized         = "UNAUTHORIZED"
	ErrCodeForbidden            = "FORBIDDEN"
	ErrCodeResourceNotFound     = "RESOURCE_NOT_FOUND"
	ErrCodeResourceLocked       = "RESOURCE_LOCKED"
	ErrCodeConstraintViolation  = "CONSTRAINT_VIOLATION"
	ErrCodeDuplicateKey         = "DUPLICATE_KEY"
	ErrCodeForeignKeyViolation  = "FOREIGN_KEY_VIOLATION"
	ErrCodeInvalidCredentials   = "INVALID_CREDENTIALS"
	ErrCodeDatabaseError        = "DATABASE_ERROR"
	ErrCodeInternalError        = "INTERNAL_ERROR"
	ErrCodeUnsupportedOperation = "UNSUPPORTED_OPERATION"
	ErrCodePoolExhausted        = "POOL_EXHAUSTED"
	ErrCodeSchemaQueryFailed    = "SCHEMA_QUERY_FAILED"
)
