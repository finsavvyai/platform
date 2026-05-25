package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// APIError represents a structured API error response
type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// ErrorResponse represents the complete error response structure
type ErrorResponse struct {
	Error     APIError `json:"error"`
	RequestID string   `json:"request_id,omitempty"`
	Timestamp string   `json:"timestamp"`
}

// Common error codes
const (
	// Authentication errors
	ErrCodeMissingToken       = "MISSING_TOKEN"
	ErrCodeInvalidToken       = "INVALID_TOKEN"
	ErrCodeTokenExpired       = "TOKEN_EXPIRED"
	ErrCodeInvalidCredentials = "INVALID_CREDENTIALS"
	ErrCodeUnauthorized       = "UNAUTHORIZED"
	ErrCodeForbidden          = "FORBIDDEN"

	// Validation errors
	ErrCodeValidationFailed = "VALIDATION_FAILED"
	ErrCodeInvalidInput     = "INVALID_INPUT"
	ErrCodeMissingRequired  = "MISSING_REQUIRED_FIELD"
	ErrCodeInvalidFormat    = "INVALID_FORMAT"

	// Resource errors
	ErrCodeNotFound      = "RESOURCE_NOT_FOUND"
	ErrCodeAlreadyExists = "RESOURCE_ALREADY_EXISTS"
	ErrCodeConflict      = "RESOURCE_CONFLICT"

	// Database errors
	ErrCodeDatabaseError     = "DATABASE_ERROR"
	ErrCodeConnectionFailed  = "CONNECTION_FAILED"
	ErrCodeQueryFailed       = "QUERY_FAILED"
	ErrCodeTransactionFailed = "TRANSACTION_FAILED"

	// Business logic errors
	ErrCodeBusinessLogic    = "BUSINESS_LOGIC_ERROR"
	ErrCodeOperationFailed  = "OPERATION_FAILED"
	ErrCodeInvalidOperation = "INVALID_OPERATION"

	// System errors
	ErrCodeInternalError      = "INTERNAL_ERROR"
	ErrCodeServiceUnavailable = "SERVICE_UNAVAILABLE"
	ErrCodeTimeout            = "TIMEOUT"
	ErrCodeRateLimitExceeded  = "RATE_LIMIT_EXCEEDED"
)

// respondWithError sends a structured error response
func (s *Server) respondWithError(c *gin.Context, statusCode int, code, message string, details interface{}) {
	requestID := c.GetString("request_id")

	errorResponse := ErrorResponse{
		Error: APIError{
			Code:    code,
			Message: message,
			Details: details,
		},
		RequestID: requestID,
		Timestamp: getCurrentTimestamp(),
	}

	// Log the error
	logrus.WithFields(logrus.Fields{
		"status_code": statusCode,
		"error_code":  code,
		"message":     message,
		"request_id":  requestID,
		"path":        c.Request.URL.Path,
		"method":      c.Request.Method,
		"user_id":     c.GetString("user_id"),
	}).Error("API error response")

	c.JSON(statusCode, errorResponse)
}

// respondWithValidationError sends a validation error response
func (s *Server) respondWithValidationError(c *gin.Context, field, message string) {
	details := map[string]string{
		"field": field,
		"issue": message,
	}
	s.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Validation failed", details)
}

// respondWithNotFound sends a not found error response
func (s *Server) respondWithNotFound(c *gin.Context, resource string) {
	message := "Resource not found"
	if resource != "" {
		message = resource + " not found"
	}
	s.respondWithError(c, http.StatusNotFound, ErrCodeNotFound, message, nil)
}

// respondWithUnauthorized sends an unauthorized error response
func (s *Server) respondWithUnauthorized(c *gin.Context, message string) {
	if message == "" {
		message = "Authentication required"
	}
	s.respondWithError(c, http.StatusUnauthorized, ErrCodeUnauthorized, message, nil)
}

// respondWithForbidden sends a forbidden error response
func (s *Server) respondWithForbidden(c *gin.Context, message string) {
	if message == "" {
		message = "Access denied"
	}
	s.respondWithError(c, http.StatusForbidden, ErrCodeForbidden, message, nil)
}

// respondWithConflict sends a conflict error response
func (s *Server) respondWithConflict(c *gin.Context, message string) {
	if message == "" {
		message = "Resource conflict"
	}
	s.respondWithError(c, http.StatusConflict, ErrCodeConflict, message, nil)
}

// respondWithInternalError sends an internal server error response
func (s *Server) respondWithInternalError(c *gin.Context, message string, err error) {
	if message == "" {
		message = "An internal error occurred"
	}

	var details interface{}
	if err != nil && s.config.Environment == "development" {
		details = err.Error()
	}

	s.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, message, details)
}

// respondWithSuccess sends a successful response
func (s *Server) respondWithSuccess(c *gin.Context, data interface{}) {
	response := map[string]interface{}{
		"success":    true,
		"data":       data,
		"request_id": c.GetString("request_id"),
		"timestamp":  getCurrentTimestamp(),
	}

	c.JSON(http.StatusOK, response)
}

// respondWithCreated sends a created response
func (s *Server) respondWithCreated(c *gin.Context, data interface{}) {
	response := map[string]interface{}{
		"success":    true,
		"data":       data,
		"request_id": c.GetString("request_id"),
		"timestamp":  getCurrentTimestamp(),
	}

	c.JSON(http.StatusCreated, response)
}

// respondWithNoContent sends a no content response
func (s *Server) respondWithNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
