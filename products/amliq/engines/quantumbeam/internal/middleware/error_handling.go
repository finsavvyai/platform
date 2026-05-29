//go:build legacy_migrated
// +build legacy_migrated

package middleware

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error      string                 `json:"error"`
	Message    string                 `json:"message,omitempty"`
	Code       string                 `json:"code,omitempty"`
	Details    interface{}            `json:"details,omitempty"`
	RequestID  string                 `json:"request_id,omitempty"`
	Timestamp  int64                  `json:"timestamp"`
	Path       string                 `json:"path,omitempty"`
	Method     string                 `json:"method,omitempty"`
	Validation *ValidationErrors      `json:"validation,omitempty"`
	Retryable  bool                   `json:"retryable,omitempty"`
	RetryAfter int                    `json:"retry_after,omitempty"`
	RateLimit  *RateLimitInfo         `json:"rate_limit,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ValidationErrors represents field validation errors
type ValidationErrors struct {
	Fields map[string][]string `json:"fields"`
	Global []string            `json:"global"`
}

// RateLimitInfo represents rate limiting information
type RateLimitInfo struct {
	Limit      int       `json:"limit"`
	Remaining  int       `json:"remaining"`
	Reset      time.Time `json:"reset"`
	RetryAfter int       `json:"retry_after"`
}

// ErrorConfig holds configuration for error handling middleware
type ErrorConfig struct {
	Environment       string                  `json:"environment"`
	IncludeStackTrace bool                    `json:"include_stack_trace"`
	LogLevel          string                  `json:"log_level"`
	RequestIDHeader   string                  `json:"request_id_header"`
	SentryDSN         string                  `json:"sentry_dsn"`
	MaxResponseSize   int64                   `json:"max_response_size"`
	CustomHandlers    map[string]http.Handler `json:"custom_handlers"`
}

// ErrorHandler middleware provides comprehensive error handling
type ErrorHandler struct {
	config    *ErrorConfig
	validator *validator.Validate
	logger    Logger
}

// Logger interface for error logging
type Logger interface {
	Error(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
}

// NewErrorHandler creates a new error handler middleware
func NewErrorHandler(config *ErrorConfig, logger Logger) *ErrorHandler {
	if config == nil {
		config = &ErrorConfig{
			Environment:       "production",
			IncludeStackTrace: false,
			LogLevel:          "error",
			RequestIDHeader:   "X-Request-ID",
			MaxResponseSize:   1 << 20, // 1MB
		}
	}

	return &ErrorHandler{
		config:    config,
		validator: validator.New(),
		logger:    logger,
	}
}

// Middleware returns the Gin middleware function
func (eh *ErrorHandler) Middleware() gin.HandlerFunc {
	return gin.CustomRecovery(eh.handlePanic)
}

// handlePanic recovers from panics and returns appropriate error response
func (eh *ErrorHandler) handlePanic(c *gin.Context, recovered interface{}) {
	var err error
	switch x := recovered.(type) {
	case string:
		err = errors.New(x)
	case error:
		err = x
	default:
		err = fmt.Errorf("unknown panic: %v", x)
	}

	eh.handleError(c, err, http.StatusInternalServerError)
}

// HandleError is the main error handling function
func (eh *ErrorHandler) HandleError(c *gin.Context, err error, statusCode int) {
	eh.handleError(c, err, statusCode)
}

// handleError processes an error and generates appropriate response
func (eh *ErrorHandler) handleError(c *gin.Context, err error, statusCode int) {
	// Generate request ID if not present
	requestID := c.GetHeader(eh.config.RequestIDHeader)
	if requestID == "" {
		requestID = c.GetString("request_id")
	}

	// Determine error type and create response
	errorResponse := eh.createErrorResponse(err, statusCode, requestID, c)

	// Log the error
	eh.logError(errorResponse, err)

	// Set appropriate headers
	eh.setErrorHeaders(c, errorResponse)

	// Return JSON response
	c.JSON(statusCode, errorResponse)
}

// createErrorResponse creates a standardized error response
func (eh *ErrorHandler) createErrorResponse(err error, statusCode int, requestID string, c *gin.Context) *ErrorResponse {
	response := &ErrorResponse{
		Error:     http.StatusText(statusCode),
		Timestamp: time.Now().Unix(),
		RequestID: requestID,
		Path:      c.Request.URL.Path,
		Method:    c.Request.Method,
		Retryable: eh.isRetryable(statusCode, err),
		Metadata:  make(map[string]interface{}),
	}

	// Handle specific error types
	switch e := err.(type) {
	case *validator.InvalidValidationError:
		response.Message = "Validation failed"
		response.Code = "VALIDATION_ERROR"
		response.Validation = eh.formatValidationErrors(e)
		response.Details = e.Error()

	case validator.ValidationErrors:
		response.Message = "Validation failed"
		response.Code = "VALIDATION_ERROR"
		response.Validation = eh.formatFieldValidationErrors(e)
		response.Details = "Invalid request parameters"

	case *json.SyntaxError:
		response.Message = "Invalid JSON format"
		response.Code = "INVALID_JSON"
		response.Details = e.Error()

	case *json.UnmarshalTypeError:
		response.Message = "Invalid data format"
		response.Code = "INVALID_FORMAT"
		response.Details = e.Error()

	case *http.MaxBytesError:
		response.Message = "Request too large"
		response.Code = "REQUEST_TOO_LARGE"
		response.Details = fmt.Sprintf("Maximum allowed size is %d bytes", eh.config.MaxResponseSize)

	default:
		// Handle common error patterns
		if strings.Contains(err.Error(), "required") {
			response.Message = "Required field missing"
			response.Code = "MISSING_FIELD"
		} else if strings.Contains(err.Error(), "invalid") {
			response.Message = "Invalid input"
			response.Code = "INVALID_INPUT"
		} else if strings.Contains(err.Error(), "unauthorized") {
			response.Message = "Unauthorized access"
			response.Code = "UNAUTHORIZED"
			response.Retryable = false
		} else if strings.Contains(err.Error(), "forbidden") {
			response.Message = "Access forbidden"
			response.Code = "FORBIDDEN"
			response.Retryable = false
		} else if strings.Contains(err.Error(), "not found") {
			response.Message = "Resource not found"
			response.Code = "NOT_FOUND"
		} else if strings.Contains(err.Error(), "timeout") {
			response.Message = "Request timeout"
			response.Code = "TIMEOUT"
			response.Retryable = true
			response.RetryAfter = 5
		} else {
			response.Message = "Internal server error"
			response.Code = "INTERNAL_ERROR"
		}

		// Add stack trace in development
		if eh.config.IncludeStackTrace && eh.config.Environment != "production" {
			response.Details = err.Error()
			response.Metadata["stack_trace"] = string(debug.Stack())
		}
	}

	return response
}

// formatValidationErrors formats validator.InvalidValidationError
func (eh *ErrorHandler) formatValidationErrors(err *validator.InvalidValidationError) *ValidationErrors {
	return &ValidationErrors{
		Fields: map[string][]string{
			err.Field(): {err.ActualTag()},
		},
		Global: []string{err.Error()},
	}
}

// formatFieldValidationErrors formats validator.ValidationErrors
func (eh *ErrorHandler) formatFieldValidationErrors(errs validator.ValidationErrors) *ValidationErrors {
	validationErrors := &ValidationErrors{
		Fields: make(map[string][]string),
		Global: make([]string, 0),
	}

	for _, err := range errs {
		field := err.Field()
		tag := err.ActualTag()
		param := err.Param()

		// Create human-readable error messages
		var message string
		switch tag {
		case "required":
			message = fmt.Sprintf("Field '%s' is required", field)
		case "min":
			message = fmt.Sprintf("Field '%s' must be at least %s", field, param)
		case "max":
			message = fmt.Sprintf("Field '%s' must be at most %s", field, param)
		case "email":
			message = fmt.Sprintf("Field '%s' must be a valid email address", field)
		case "url":
			message = fmt.Sprintf("Field '%s' must be a valid URL", field)
		case "numeric":
			message = fmt.Sprintf("Field '%s' must be numeric", field)
		case "alpha":
			message = fmt.Sprintf("Field '%s' must contain only letters", field)
		case "alphanum":
			message = fmt.Sprintf("Field '%s' must contain only letters and numbers", field)
		case "uuid":
			message = fmt.Sprintf("Field '%s' must be a valid UUID", field)
		case "datetime":
			message = fmt.Sprintf("Field '%s' must be a valid datetime", field)
		case "oneof":
			message = fmt.Sprintf("Field '%s' must be one of: %s", field, param)
		default:
			message = fmt.Sprintf("Field '%s' failed validation: %s", field, tag)
		}

		validationErrors.Fields[field] = append(validationErrors.Fields[field], message)
	}

	return validationErrors
}

// setErrorHeaders sets appropriate error response headers
func (eh *ErrorHandler) setErrorHeaders(c *gin.Context, response *ErrorResponse) {
	// Set standard headers
	c.Header("Content-Type", "application/json")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("X-Request-ID", response.RequestID)

	// Set rate limit headers if applicable
	if response.RateLimit != nil {
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", response.RateLimit.Limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", response.RateLimit.Remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", response.RateLimit.Reset.Unix()))
		c.Header("Retry-After", fmt.Sprintf("%d", response.RateLimit.RetryAfter))
	} else if response.RetryAfter > 0 {
		c.Header("Retry-After", fmt.Sprintf("%d", response.RetryAfter))
	}

	// Set cache headers for errors
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
}

// isRetryable determines if an error is retryable
func (eh *ErrorHandler) isRetryable(statusCode int, err error) bool {
	// Don't retry client errors (4xx)
	if statusCode >= 400 && statusCode < 500 {
		return false
	}

	// Retry on server errors (5xx) and specific client errors
	if statusCode >= 500 {
		return true
	}

	// Check specific error patterns
	errStr := err.Error()
	retryablePatterns := []string{
		"timeout",
		"connection refused",
		"temporary failure",
		"service unavailable",
		"rate limit",
		"too many requests",
	}

	for _, pattern := range retryablePatterns {
		if strings.Contains(strings.ToLower(errStr), pattern) {
			return true
		}
	}

	return false
}

// logError logs the error with appropriate level and context
func (eh *ErrorHandler) logError(response *ErrorResponse, err error) {
	fields := []interface{}{
		"error_code", response.Code,
		"request_id", response.RequestID,
		"path", response.Path,
		"method", response.Method,
		"status_code", response.Error,
		"retryable", response.Retryable,
	}

	switch eh.config.LogLevel {
	case "debug":
		eh.logger.Debug("Request error", append(fields, "error", err.Error())...)
	case "info":
		eh.logger.Info("Request error", fields...)
	case "warn":
		eh.logger.Warn("Request error", fields...)
	default: // error
		eh.logger.Error("Request error", append(fields, "error", err.Error())...)
	}
}

// ValidationError middleware for request validation
func (eh *ErrorHandler) ValidationError() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if there are validation errors
		if len(c.Errors) > 0 {
			err := c.Errors.Last().Err
			eh.HandleError(c, err, http.StatusBadRequest)
			c.Abort()
			return
		}
	}
}

// RequestSizeLimit middleware
func (eh *ErrorHandler) RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			err := &http.MaxBytesError{}
			eh.HandleError(c, err, http.StatusRequestEntityTooLarge)
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequestID middleware generates unique request IDs
func (eh *ErrorHandler) RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader(eh.config.RequestIDHeader)
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Set("request_id", requestID)
		c.Header(eh.config.RequestIDHeader, requestID)
		c.Next()
	}
}

// Timeout middleware for request timeout handling
func (eh *ErrorHandler) Timeout(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		c.Request = c.Request.WithContext(ctx)

		finished := make(chan struct{})
		go func() {
			defer close(finished)
			c.Next()
		}()

		select {
		case <-finished:
			return
		case <-ctx.Done():
			err := context.DeadlineExceeded
			eh.HandleError(c, err, http.StatusRequestTimeout)
			c.Abort()
		}
	}
}

// RateLimitError middleware for rate limiting
func (eh *ErrorHandler) RateLimitError(limiter RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !limiter.Allow(c) {
			info := limiter.GetInfo(c)

			response := &ErrorResponse{
				Error:     "Rate limit exceeded",
				Message:   "Too many requests",
				Code:      "RATE_LIMIT_EXCEEDED",
				Timestamp: time.Now().Unix(),
				RequestID: c.GetString("request_id"),
				Path:      c.Request.URL.Path,
				Method:    c.Request.Method,
				Retryable: true,
				RateLimit: &RateLimitInfo{
					Limit:      info.Limit,
					Remaining:  info.Remaining,
					Reset:      info.Reset,
					RetryAfter: info.RetryAfter,
				},
			}

			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", info.Limit))
			c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", info.Remaining))
			c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", info.Reset.Unix()))
			c.Header("Retry-After", fmt.Sprintf("%d", info.RetryAfter))

			c.JSON(http.StatusTooManyRequests, response)
			c.Abort()
			return
		}
		c.Next()
	}
}

// RateLimiter interface for rate limiting
type RateLimiter interface {
	Allow(c *gin.Context) bool
	GetInfo(c *gin.Context) RateLimitInfo
}

// Utility function to generate request IDs
func generateRequestID() string {
	// Generate a unique request ID
	return fmt.Sprintf("req_%d_%s", time.Now().UnixNano(), randomString(8))
}

// Simple random string generator
func randomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(b)
}

// Error types for better error handling
var (
	ErrInvalidRequest     = errors.New("invalid request")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrForbidden          = errors.New("forbidden")
	ErrNotFound           = errors.New("not found")
	ErrConflict           = errors.New("conflict")
	ErrTooManyRequests    = errors.New("too many requests")
	ErrInternalServer     = errors.New("internal server error")
	ErrServiceUnavailable = errors.New("service unavailable")
	ErrTimeout            = errors.New("timeout")
	ErrRateLimited        = errors.New("rate limited")
	ErrValidationFailed   = errors.New("validation failed")
	ErrInvalidJSON        = errors.New("invalid json")
	ErrRequestTooLarge    = errors.New("request too large")
	ErrMissingRequired    = errors.New("missing required field")
	ErrInvalidFormat      = errors.New("invalid format")
	ErrDuplicateResource  = errors.New("duplicate resource")
	ErrResourceLocked     = errors.New("resource locked")
)

// Business error types
var (
	ErrInsufficientFunds = errors.New("insufficient funds")
	ErrInvalidAmount     = errors.New("invalid amount")
	ErrInvalidCurrency   = errors.New("invalid currency")
	ErrExpiredCard       = errors.New("expired card")
	ErrInvalidCard       = errors.New("invalid card")
	ErrTransactionFailed = errors.New("transaction failed")
	ErrFraudDetected     = errors.New("fraud detected")
	ErrAccountLocked     = errors.New("account locked")
	ErrAccountSuspended  = errors.New("account suspended")
	ErrKYCRequired       = errors.New("kyc required")
	ErrLimitExceeded     = errors.New("limit exceeded")
)

// HTTP status code mappings for error types
var ErrorCodeMap = map[error]int{
	ErrInvalidRequest:     http.StatusBadRequest,
	ErrUnauthorized:       http.StatusUnauthorized,
	ErrForbidden:          http.StatusForbidden,
	ErrNotFound:           http.StatusNotFound,
	ErrConflict:           http.StatusConflict,
	ErrTooManyRequests:    http.StatusTooManyRequests,
	ErrInternalServer:     http.StatusInternalServerError,
	ErrServiceUnavailable: http.StatusServiceUnavailable,
	ErrTimeout:            http.StatusRequestTimeout,
	ErrRateLimited:        http.StatusTooManyRequests,
	ErrValidationFailed:   http.StatusBadRequest,
	ErrInvalidJSON:        http.StatusBadRequest,
	ErrRequestTooLarge:    http.StatusRequestEntityTooLarge,
	ErrMissingRequired:    http.StatusBadRequest,
	ErrInvalidFormat:      http.StatusBadRequest,
	ErrDuplicateResource:  http.StatusConflict,
	ErrResourceLocked:     http.StatusLocked,

	// Business errors
	ErrInsufficientFunds: http.StatusPaymentRequired,
	ErrInvalidAmount:     http.StatusBadRequest,
	ErrInvalidCurrency:   http.StatusBadRequest,
	ErrExpiredCard:       http.StatusPaymentRequired,
	ErrInvalidCard:       http.StatusPaymentRequired,
	ErrTransactionFailed: http.StatusPaymentRequired,
	ErrFraudDetected:     http.StatusForbidden,
	ErrAccountLocked:     http.StatusForbidden,
	ErrAccountSuspended:  http.StatusForbidden,
	ErrKYCRequired:       http.StatusForbidden,
	ErrLimitExceeded:     http.StatusPaymentRequired,
}