package sdln

import (
	"fmt"
	"net/http"
	"time"
)

// ErrorType represents the type of error
type ErrorType string

const (
	// ErrTypeInvalidRequest indicates a bad request
	ErrTypeInvalidRequest ErrorType = "invalid_request"

	// ErrTypeUnauthorized indicates authentication failure
	ErrTypeUnauthorized ErrorType = "unauthorized"

	// ErrTypeForbidden indicates authorization failure
	ErrTypeForbidden ErrorType = "forbidden"

	// ErrTypeNotFound indicates resource not found
	ErrTypeNotFound ErrorType = "not_found"

	// ErrTypeConflict indicates resource conflict
	ErrTypeConflict ErrorType = "conflict"

	// ErrTypeRateLimit indicates rate limit exceeded
	ErrTypeRateLimit ErrorType = "rate_limit"

	// ErrTypeInternalError indicates server error
	ErrTypeInternalError ErrorType = "internal_error"

	// ErrTypeServiceUnavailable indicates service is down
	ErrTypeServiceUnavailable ErrorType = "service_unavailable"

	// ErrTypeTimeout indicates request timeout
	ErrTypeTimeout ErrorType = "timeout"

	// ErrTypeNetworkError indicates network connectivity issue
	ErrTypeNetworkError ErrorType = "network_error"

	// ErrTypeValidationError indicates input validation failed
	ErrTypeValidationError ErrorType = "validation_error"

	// ErrTypeAuthenticationError indicates authentication failed
	ErrTypeAuthenticationError ErrorType = "authentication_error"

	// ErrTypeEncryptionError indicates encryption/decryption failed
	ErrTypeEncryptionError ErrorType = "encryption_error"

	// ErrTypePolicyError indicates policy violation
	ErrTypePolicyError ErrorType = "policy_error"
)

// APIError represents an API error response
type APIError struct {
	Type       ErrorType      `json:"type"`
	Code       string         `json:"code"`
	Message    string         `json:"message"`
	Details    interface{}    `json:"details,omitempty"`
	RequestID  string         `json:"request_id,omitempty"`
	Timestamp  time.Time      `json:"timestamp"`
	RetryAfter *time.Duration `json:"retry_after,omitempty"`

	// HTTP specific fields
	StatusCode int         `json:"status_code"`
	Header     http.Header `json:"-"`

	// Internal fields
	wrapped error
}

// Error implements the error interface
func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("[%s:%s] %s", e.Type, e.Code, e.Message)
	}
	return fmt.Sprintf("[%s] %s", e.Type, e.Message)
}

// Unwrap returns the wrapped error
func (e *APIError) Unwrap() error {
	return e.wrapped
}

// IsRetryable returns true if the error is retryable
func (e *APIError) IsRetryable() bool {
	switch e.Type {
	case ErrTypeRateLimit, ErrTypeInternalError, ErrTypeServiceUnavailable,
		ErrTypeTimeout, ErrTypeNetworkError:
		return true
	default:
		return false
	}
}

// IsClientError returns true if the error is a client error (4xx)
func (e *APIError) IsClientError() bool {
	return e.StatusCode >= 400 && e.StatusCode < 500
}

// IsServerError returns true if the error is a server error (5xx)
func (e *APIError) IsServerError() bool {
	return e.StatusCode >= 500
}

// NewAPIError creates a new API error
func NewAPIError(errorType ErrorType, message string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Message:    message,
		StatusCode: statusCode,
		Timestamp:  time.Now().UTC(),
	}
}

// NewAPIErrorWithCode creates a new API error with a code
func NewAPIErrorWithCode(errorType ErrorType, code, message string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
		Timestamp:  time.Now().UTC(),
	}
}

// WrapAPIError wraps an existing error with API error context
func WrapAPIError(err error, errorType ErrorType, message string, statusCode int) *APIError {
	return &APIError{
		Type:       errorType,
		Message:    message,
		StatusCode: statusCode,
		Timestamp:  time.Now().UTC(),
		wrapped:    err,
	}
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string      `json:"field"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// ValidationErrors represents multiple validation errors
type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

// Error implements the error interface
func (ve *ValidationErrors) Error() string {
	if len(ve.Errors) == 0 {
		return "validation failed"
	}
	if len(ve.Errors) == 1 {
		return fmt.Sprintf("validation failed: %s", ve.Errors[0].Message)
	}
	return fmt.Sprintf("validation failed: %d errors", len(ve.Errors))
}

// Add adds a validation error
func (ve *ValidationErrors) Add(field, message string, value interface{}) {
	ve.Errors = append(ve.Errors, ValidationError{
		Field:   field,
		Message: message,
		Value:   value,
	})
}

// HasErrors returns true if there are validation errors
func (ve *ValidationErrors) HasErrors() bool {
	return len(ve.Errors) > 0
}

// ToAPIError converts validation errors to an API error
func (ve *ValidationErrors) ToAPIError() *APIError {
	return NewAPIError(ErrTypeValidationError, ve.Error(), http.StatusBadRequest)
}

// RetryError represents a retry error
type RetryError struct {
	Attempt     int
	MaxAttempts int
	LastError   error
	TotalTime   time.Duration
}

// Error implements the error interface
func (re *RetryError) Error() string {
	return fmt.Sprintf("retry failed after %d attempts (last error: %v)", re.Attempt, re.LastError)
}

// Unwrap returns the wrapped error
func (re *RetryError) Unwrap() error {
	return re.LastError
}

// TimeoutError represents a timeout error
type TimeoutError struct {
	Timeout   time.Duration
	Operation string
}

// Error implements the error interface
func (te *TimestampoutError) Error() string {
	return fmt.Sprintf("operation %s timed out after %v", te.Operation, te.Timeout)
}

// IsTimeout returns true if the error is a timeout error
func (te *TimestampoutError) IsTimeout() bool {
	return true
}

// CircuitBreakerError represents a circuit breaker error
type CircuitBreakerError struct {
	Service string
	State   string
}

// Error implements the error interface
func (cbe *CircuitBreakerError) Error() string {
	return fmt.Sprintf("circuit breaker open for service %s (state: %s)", cbe.Service, cbe.State)
}

// IsCircuitBreakerOpen returns true if the circuit breaker is open
func (cbe *CircuitBreakerError) IsCircuitBreakerOpen() bool {
	return cbe.State == "open"
}

// RateLimitError represents a rate limit error
type RateLimitError struct {
	Limit      int
	Remaining  int
	ResetTime  time.Time
	RetryAfter time.Duration
}

// Error implements the error interface
func (rle *RateLimitError) Error() string {
	return fmt.Sprintf("rate limit exceeded: %d/%d (reset in %v)", rle.Remaining, rle.Limit, rle.RetryAfter)
}

// IsRateLimit returns true if the error is a rate limit error
func (rle *RateLimitError) IsRateLimit() bool {
	return true
}

// Common error constructors
func ErrInvalidRequest(message string) *APIError {
	return NewAPIError(ErrTypeInvalidRequest, message, http.StatusBadRequest)
}

func ErrUnauthorized(message string) *APIError {
	return NewAPIError(ErrTypeUnauthorized, message, http.StatusUnauthorized)
}

func ErrForbidden(message string) *APIError {
	return NewAPIError(ErrTypeForbidden, message, http.StatusForbidden)
}

func ErrNotFound(message string) *APIError {
	return NewAPIError(ErrTypeNotFound, message, http.StatusNotFound)
}

func ErrConflict(message string) *APIError {
	return NewAPIError(ErrTypeConflict, message, http.StatusConflict)
}

func ErrRateLimit(message string, retryAfter time.Duration) *APIError {
	err := NewAPIError(ErrTypeRateLimit, message, http.StatusTooManyRequests)
	err.RetryAfter = &retryAfter
	return err
}

func ErrInternalServer(message string) *APIError {
	return NewAPIError(ErrTypeInternalError, message, http.StatusInternalServerError)
}

func ErrServiceUnavailable(message string) *APIError {
	return NewAPIError(ErrTypeServiceUnavailable, message, http.StatusServiceUnavailable)
}

func ErrTimeout(operation string, timeout time.Duration) *TimestampoutError {
	return &TimeoutError{
		Operation: operation,
		Timeout:   timeout,
	}
}

func ErrNetwork(message string) *APIError {
	return NewAPIError(ErrTypeNetworkError, message, 0)
}

func ErrEncryption(message string) *APIError {
	return NewAPIError(ErrTypeEncryptionError, message, http.StatusInternalServerError)
}

func ErrPolicy(message string) *APIError {
	return NewAPIError(ErrTypePolicyError, message, http.StatusForbidden)
}
