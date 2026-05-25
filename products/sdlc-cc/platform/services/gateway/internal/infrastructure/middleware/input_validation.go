//go:build !ignore

package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/render"
	"github.com/sirupsen/logrus"
)

// InputValidationConfig holds configuration for input validation
type InputValidationConfig struct {
	// Maximum request body size in bytes
	MaxBodySize int64

	// Maximum query string length
	MaxQueryStringLength int

	// Maximum URL length
	MaxURLLength int

	// Maximum header value length
	MaxHeaderValueLength int

	// Maximum number of headers
	MaxHeaders int

	// Enable JSON validation
	ValidateJSON bool

	// Enable SQL injection detection
	DetectSQLInjection bool

	// Enable XSS detection
	DetectXSS bool

	// Enable path traversal detection
	DetectPathTraversal bool

	// Allowed content types
	AllowedContentTypes []string

	// Blocked patterns (regex)
	BlockedPatterns []*regexp.Regexp
}

// DefaultInputValidationConfig returns default validation configuration
func DefaultInputValidationConfig() InputValidationConfig {
	return InputValidationConfig{
		MaxBodySize:          10 * 1024 * 1024, // 10MB
		MaxQueryStringLength: 2048,
		MaxURLLength:         2048,
		MaxHeaderValueLength: 4096,
		MaxHeaders:           100,
		ValidateJSON:         true,
		DetectSQLInjection:   true,
		DetectXSS:            true,
		DetectPathTraversal:  true,
		AllowedContentTypes:  []string{"application/json", "application/x-www-form-urlencoded", "multipart/form-data", "text/plain"},
		BlockedPatterns:      getDefaultBlockedPatterns(),
	}
}

// getDefaultBlockedPatterns returns default security blocked patterns
func getDefaultBlockedPatterns() []*regexp.Regexp {
	return []*regexp.Regexp{
		// SQL injection patterns
		regexp.MustCompile(`(?i)(\bunion\b.*\bselect\b)|(\bselect\b.*\bfrom\b)|(\binsert\b.*\binto\b)|(\bdelete\b.*\bfrom\b)|(\bdrop\b.*\btable\b)|(\bexec\b|\bexecute\b)`),
		// XSS patterns
		regexp.MustCompile(`(?i)<script[^>]*>.*?</script>|javascript:|on\w+\s*=`),
		// Path traversal
		regexp.MustCompile(`\.\.[/\\]`),
		// Command injection
		regexp.MustCompile(`[;&|` + "`" + `$]`),
	}
}

// InputValidationMiddleware provides comprehensive input validation
type InputValidationMiddleware struct {
	config InputValidationConfig
	logger *logrus.Logger
}

// NewInputValidationMiddleware creates a new input validation middleware
func NewInputValidationMiddleware(config InputValidationConfig, logger *logrus.Logger) *InputValidationMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	return &InputValidationMiddleware{
		config: config,
		logger: logger,
	}
}

// Middleware returns the chi middleware function
func (ivm *InputValidationMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Validate URL length
		if len(r.URL.String()) > ivm.config.MaxURLLength {
			ivm.validationError(w, r, "URL_TOO_LONG", "URL exceeds maximum allowed length")
			return
		}

		// Validate query string length
		if len(r.URL.RawQuery) > ivm.config.MaxQueryStringLength {
			ivm.validationError(w, r, "QUERY_TOO_LONG", "Query string exceeds maximum allowed length")
			return
		}

		// Validate query parameters for security issues
		if err := ivm.validateQueryParams(r); err != nil {
			ivm.validationError(w, r, "INVALID_QUERY", err.Error())
			return
		}

		// Validate headers
		if err := ivm.validateHeaders(r); err != nil {
			ivm.validationError(w, r, "INVALID_HEADERS", err.Error())
			return
		}

		// Validate content type for POST/PUT/PATCH
		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch {
			contentType := r.Header.Get("Content-Type")
			if contentType != "" {
				// Extract content type (remove charset and other parameters)
				ct := strings.Split(contentType, ";")[0]
				ct = strings.TrimSpace(ct)

				if !ivm.isContentTypeAllowed(ct) {
					ivm.validationError(w, r, "UNSUPPORTED_MEDIA_TYPE", fmt.Sprintf("Content type %s is not allowed", ct))
					return
				}
			}
		}

		// Validate request body
		if r.Body != nil && r.ContentLength > 0 {
			if err := ivm.validateBody(r); err != nil {
				ivm.validationError(w, r, "INVALID_BODY", err.Error())
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// validateQueryParams validates query parameters for security issues
func (ivm *InputValidationMiddleware) validateQueryParams(r *http.Request) error {
	for key, values := range r.URL.Query() {
		// Check key for suspicious patterns
		if err := ivm.checkForMaliciousInput(key); err != nil {
			return fmt.Errorf("invalid query parameter key: %w", err)
		}

		// Check values for suspicious patterns
		for _, value := range values {
			if err := ivm.checkForMaliciousInput(value); err != nil {
				return fmt.Errorf("invalid query parameter value for %s: %w", key, err)
			}
		}
	}

	return nil
}

// validateHeaders validates HTTP headers
func (ivm *InputValidationMiddleware) validateHeaders(r *http.Request) error {
	// Check header count
	if len(r.Header) > ivm.config.MaxHeaders {
		return fmt.Errorf("too many headers (max: %d)", ivm.config.MaxHeaders)
	}

	// Check each header
	for key, values := range r.Header {
		// Skip validation for certain headers that may contain special characters
		if ivm.shouldSkipHeaderValidation(key) {
			continue
		}

		for _, value := range values {
			// Check length
			if len(value) > ivm.config.MaxHeaderValueLength {
				return fmt.Errorf("header %s exceeds maximum length", key)
			}

			// Check for malicious patterns in header values
			if ivm.config.DetectXSS || ivm.config.DetectSQLInjection {
				if err := ivm.checkForMaliciousInput(value); err != nil {
					return fmt.Errorf("suspicious content in header %s: %w", key, err)
				}
			}
		}
	}

	return nil
}

// shouldSkipHeaderValidation returns true if header should skip validation
func (ivm *InputValidationMiddleware) shouldSkipHeaderValidation(key string) bool {
	skipHeaders := []string{
		"Authorization", "Cookie", "Set-Cookie",
		"X-API-Key", "X-Auth-Token",
	}

	keyLower := strings.ToLower(key)
	for _, skip := range skipHeaders {
		if strings.ToLower(skip) == keyLower {
			return true
		}
	}

	return false
}

// validateBody validates the request body
func (ivm *InputValidationMiddleware) validateBody(r *http.Request) error {
	// Check content length
	if r.ContentLength > ivm.config.MaxBodySize {
		return fmt.Errorf("request body too large (max: %d bytes)", ivm.config.MaxBodySize)
	}

	// Read body (limit to max size)
	limitedReader := io.LimitReader(r.Body, ivm.config.MaxBodySize+1)
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return fmt.Errorf("failed to read request body: %w", err)
	}

	// Check if we hit the limit
	if int64(len(bodyBytes)) > ivm.config.MaxBodySize {
		return fmt.Errorf("request body exceeds maximum size")
	}

	// Restore body for downstream handlers
	r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// Validate UTF-8 encoding
	if !utf8.Valid(bodyBytes) {
		return fmt.Errorf("request body contains invalid UTF-8 sequences")
	}

	// Check for malicious patterns in body
	bodyString := string(bodyBytes)
	if err := ivm.checkForMaliciousInput(bodyString); err != nil {
		return err
	}

	// Validate JSON if enabled and content type is JSON
	if ivm.config.ValidateJSON {
		contentType := r.Header.Get("Content-Type")
		if strings.Contains(contentType, "application/json") {
			if !json.Valid(bodyBytes) {
				return fmt.Errorf("invalid JSON in request body")
			}
		}
	}

	return nil
}

// checkForMaliciousInput checks input for common attack patterns
func (ivm *InputValidationMiddleware) checkForMaliciousInput(input string) error {
	// Check SQL injection
	if ivm.config.DetectSQLInjection {
		if ivm.detectsSQLInjection(input) {
			return fmt.Errorf("potential SQL injection detected")
		}
	}

	// Check XSS
	if ivm.config.DetectXSS {
		if ivm.detectsXSS(input) {
			return fmt.Errorf("potential XSS attack detected")
		}
	}

	// Check path traversal
	if ivm.config.DetectPathTraversal {
		if ivm.detectsPathTraversal(input) {
			return fmt.Errorf("potential path traversal detected")
		}
	}

	// Check against custom blocked patterns
	for _, pattern := range ivm.config.BlockedPatterns {
		if pattern.MatchString(input) {
			return fmt.Errorf("blocked pattern detected")
		}
	}

	return nil
}

// detectsSQLInjection checks for SQL injection patterns
func (ivm *InputValidationMiddleware) detectsSQLInjection(input string) bool {
	// Common SQL injection patterns
	patterns := []string{
		"union select", "union all select", "union distinct select",
		"select * from", "insert into", "delete from", "drop table",
		"exec(", "execute(", "eval(", "system(",
		"1=1", "1 = 1", "or 1=1", "and 1=1",
		"' or '", "' or 1=1", "' or 1 = 1",
		"admin'--", "admin'/*",
		"xp_cmdshell", "sp_executesql",
	}

	inputLower := strings.ToLower(input)
	for _, pattern := range patterns {
		if strings.Contains(inputLower, pattern) {
			return true
		}
	}

	return false
}

// detectsXSS checks for XSS patterns
func (ivm *InputValidationMiddleware) detectsXSS(input string) bool {
	// Common XSS patterns
	patterns := []string{
		"<script", "</script>", "javascript:",
		"onerror=", "onload=", "onclick=", "onmouseover=",
		"onfocus=", "onblur=", "onsubmit=",
		"eval(", "alert(", "document.cookie",
		"<iframe", "<object", "<embed",
		"fromCharCode", "String.fromCharCode",
	}

	inputLower := strings.ToLower(input)
	for _, pattern := range patterns {
		if strings.Contains(inputLower, pattern) {
			return true
		}
	}

	return false
}

// detectsPathTraversal checks for path traversal patterns
func (ivm *InputValidationMiddleware) detectsPathTraversal(input string) bool {
	// Check for ../ or ..\ patterns
	if strings.Contains(input, "../") || strings.Contains(input, "..\\") {
		return true
	}

	// Check for encoded variations
	encodedVariations := []string{
		"%2e%2e", "%2e%2e%2f", "%2e%2e%5c",
		"..%2f", "..%5c", "%252e%252e",
	}

	inputLower := strings.ToLower(input)
	for _, variation := range encodedVariations {
		if strings.Contains(inputLower, variation) {
			return true
		}
	}

	return false
}

// isContentTypeAllowed checks if content type is allowed
func (ivm *InputValidationMiddleware) isContentTypeAllowed(contentType string) bool {
	for _, allowed := range ivm.config.AllowedContentTypes {
		if strings.EqualFold(contentType, allowed) {
			return true
		}
	}
	return false
}

// validationError sends a validation error response
func (ivm *InputValidationMiddleware) validationError(w http.ResponseWriter, r *http.Request, code, message string) {
	ivm.logger.WithFields(logrus.Fields{
		"error_code": code,
		"message":    message,
		"path":       r.URL.Path,
		"method":     r.Method,
		"remote":     r.RemoteAddr,
	}).Warn("Input validation failed")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)

	render.JSON(w, r, map[string]interface{}{
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
		"meta": map[string]interface{}{
			"timestamp": r.URL.Query().Get("timestamp"),
		},
	})
}

// PathValidationMiddleware validates URL path parameters
func PathValidationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check for path traversal in URL path
		if strings.Contains(r.URL.Path, "..") {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		// Validate URL encoding
		_, err := url.PathUnescape(r.URL.Path)
		if err != nil {
			http.Error(w, "Invalid URL encoding", http.StatusBadRequest)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// InputValidationMiddlewareFunc is a convenience function that creates
// a middleware with default validation configuration
func InputValidationMiddlewareFunc() func(http.Handler) http.Handler {
	ivm := NewInputValidationMiddleware(DefaultInputValidationConfig(), nil)
	return ivm.Middleware
}

// SanitizeInput removes potentially dangerous characters from input
func SanitizeInput(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// Remove control characters except newline, tab, and carriage return
	result := strings.Builder{}
	for _, r := range input {
		if r == '\n' || r == '\t' || r == '\r' || r >= 32 {
			result.WriteRune(r)
		}
	}

	return result.String()
}

// ValidateEmail validates email format
func ValidateEmail(email string) bool {
	// Simple email validation regex
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ValidateUUID validates UUID format
func ValidateUUID(id string) bool {
	uuidRegex := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	return uuidRegex.MatchString(id)
}

// ValidatePhoneNumber validates phone number format (E.164)
func ValidatePhoneNumber(phone string) bool {
	phoneRegex := regexp.MustCompile(`^\+?[1-9]\d{1,14}$`)
	return phoneRegex.MatchString(phone)
}

// ValidateURL validates URL format
func ValidateURL(rawURL string) bool {
	_, err := url.ParseRequestURI(rawURL)
	return err == nil
}
