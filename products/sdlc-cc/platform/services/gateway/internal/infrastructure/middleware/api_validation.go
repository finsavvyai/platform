//go:build ignore

package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/legacy"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// ValidationConfig holds configuration for API validation
type ValidationConfig struct {
	// Enable request validation
	EnableRequestValidation bool

	// Enable response validation
	EnableResponseValidation bool

	// Strict mode: reject on any validation error
	StrictMode bool

	// Skip validation for these paths
	SkipPaths []string

	// Skip validation for these methods
	SkipMethods []string

	// Maximum request body size
	MaxRequestBodySize int64

	// Custom validation functions
	CustomValidators map[string]CustomValidator

	// Security requirements
	SecurityRequirements []map[string][]string

	// OpenAPI specification loader
	SpecLoader *openapi3.T
}

// CustomValidator represents a custom validation function
type CustomValidator func(interface{}, *openapi3.Schema) error

// ValidationResult holds the result of validation
type ValidationResult struct {
	Valid  bool
	Errors []ValidationError
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string      `json:"field"`
	Message string      `json:"message"`
	Value   interface{} `json:"value,omitempty"`
	Code    string      `json:"code"`
}

// ValidationMiddleware handles request/response validation using OpenAPI schemas
type ValidationMiddleware struct {
	config  ValidationConfig
	doc     *openapi3.T
	router  *legacy.Router
	logger  *logrus.Logger
	metrics ValidationMetrics
}

// ValidationMetrics tracks validation metrics
type ValidationMetrics struct {
	RequestsValidated    int64
	ResponsesValidated   int64
	ValidationErrors     int64
	ValidationTimeMs     int64
	CustomValidationsRun int64
}

// NewValidationMiddleware creates a new validation middleware
func NewValidationMiddleware(config ValidationConfig, logger *logrus.Logger) (*ValidationMiddleware, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Load OpenAPI specification
	doc := config.SpecLoader
	if doc == nil {
		return nil, fmt.Errorf("OpenAPI specification is required")
	}

	// Validate the specification
	err := doc.Validate(context.Background())
	if err != nil {
		return nil, fmt.Errorf("invalid OpenAPI specification: %w", err)
	}

	// Create router
	router, err := legacy.NewRouter(doc)
	if err != nil {
		return nil, fmt.Errorf("failed to create router: %w", err)
	}

	return &ValidationMiddleware{
		config:  config,
		doc:     doc,
		router:  router,
		logger:  logger,
		metrics: ValidationMetrics{},
	}, nil
}

// Middleware returns the chi middleware function
func (vm *ValidationMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()

		// Check if validation should be skipped
		if vm.shouldSkipValidation(r) {
			next.ServeHTTP(w, r)
			return
		}

		// Find route in OpenAPI spec
		route, pathParams, err := vm.router.FindRoute(r)
		if err != nil {
			vm.handleRouteNotFound(w, r, err)
			return
		}

		// Add route info to context
		ctx := context.WithValue(r.Context(), RouteKey, route)
		ctx = context.WithValue(ctx, PathParamsKey, pathParams)

		// Validate request
		if vm.config.EnableRequestValidation {
			if validationErr := vm.validateRequest(w, r.WithContext(ctx), route, pathParams); validationErr != nil {
				return
			}
		}

		// Wrap response writer to capture response
		if vm.config.EnableResponseValidation {
			wrappedWriter := &validationResponseWriter{
				ResponseWriter: w,
				buffer:         &bytes.Buffer{},
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(wrappedWriter, r.WithContext(ctx))

			// Validate response
			vm.validateResponse(wrappedWriter, r.WithContext(ctx), route, pathParams)

			// Write response if not already written
			if !wrappedWriter.written {
				vm.writeResponse(w, wrappedWriter)
			}
		} else {
			next.ServeHTTP(w, r.WithContext(ctx))
		}

		// Update metrics
		vm.metrics.RequestsValidated++
		vm.metrics.ValidationTimeMs += time.Since(startTime).Milliseconds()
	})
}

// shouldSkipValidation checks if validation should be skipped
func (vm *ValidationMiddleware) shouldSkipValidation(r *http.Request) bool {
	// Check method
	for _, method := range vm.config.SkipMethods {
		if r.Method == method {
			return true
		}
	}

	// Check path
	for _, path := range vm.config.SkipPaths {
		matched, _ := regexp.MatchString(path, r.URL.Path)
		if matched {
			return true
		}
	}

	return false
}

// validateRequest validates the incoming request
func (vm *ValidationMiddleware) validateRequest(w http.ResponseWriter, r *http.Request, route *legacy.Route, pathParams map[string]string) error {
	// Create request validation input
	input := &openapi3filter.RequestValidationInput{
		Request:    r,
		PathParams: pathParams,
		Route:      route,
		Options: &openapi3filter.Options{
			ExcludeRequestBody:    false,
			ExcludeResponseBody:   true,
			IncludeResponseStatus: false,
		},
	}

	// Add custom parameter validator
	if len(vm.config.CustomValidators) > 0 {
		input.Options.ParamDecoder = vm.createCustomParamDecoder()
	}

	// Validate request
	err := openapi3filter.ValidateRequest(context.Background(), input)
	if err != nil {
		vm.handleValidationError(w, r, "request", err)
		return fmt.Errorf("request validation failed: %w", err)
	}

	// Run custom validations
	if err := vm.runCustomValidations(r, route); err != nil {
		vm.handleValidationError(w, r, "custom", err)
		return fmt.Errorf("custom validation failed: %w", err)
	}

	vm.metrics.CustomValidationsRun++
	return nil
}

// validateResponse validates the response
func (vm *ValidationMiddleware) validateResponse(rw *validationResponseWriter, r *http.Request, route *legacy.Route, pathParams map[string]string) {
	// Create response validation input
	input := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{
			Request:    r,
			PathParams: pathParams,
			Route:      route,
		},
		Status: rw.statusCode,
		Header: rw.Header(),
		Options: &openapi3filter.Options{
			ExcludeRequestBody:    true,
			ExcludeResponseBody:   false,
			IncludeResponseStatus: true,
		},
	}

	// Read response body
	responseBody := rw.buffer.Bytes()
	if len(responseBody) > 0 {
		input.SetBodyBytes(responseBody)
	}

	// Validate response
	err := openapi3filter.ValidateResponse(context.Background(), input)
	if err != nil {
		vm.logger.WithFields(logrus.Fields{
			"error":       err.Error(),
			"status_code": rw.statusCode,
			"path":        r.URL.Path,
			"method":      r.Method,
		}).Warn("Response validation failed")

		// Don't fail the request for response validation errors unless in strict mode
		if vm.config.StrictMode {
			vm.handleValidationError(rw, r, "response", err)
		}
	}

	vm.metrics.ResponsesValidated++
}

// runCustomValidators runs custom validation functions
func (vm *ValidationMiddleware) runCustomValidations(r *http.Request, route *legacy.Route) error {
	// Parse request body if available
	var requestBody interface{}
	if r.Body != nil && r.ContentLength > 0 {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			return fmt.Errorf("failed to read request body: %w", err)
		}

		// Restore body for subsequent reads
		r.Body = io.NopCloser(bytes.NewReader(body))

		if len(body) > 0 {
			if err := json.Unmarshal(body, &requestBody); err != nil {
				return fmt.Errorf("failed to unmarshal request body: %w", err)
			}
		}
	}

	// Run custom validators
	for validatorName, validator := range vm.config.CustomValidators {
		// Find the appropriate schema for this endpoint
		operation := route.Operation
		if operation == nil || operation.RequestBody == nil {
			continue
		}

		mediaType := "application/json"
		requestBodyRef := operation.RequestBody.Value
		if requestBodyRef != nil {
			if requestBodyContent := requestBodyRef.Content; requestBodyContent != nil {
				if _, ok := requestBodyContent[mediaType]; !ok {
					// Try other media types
					for mt := range requestBodyContent {
						mediaType = mt
						break
					}
				}

				if schemaRef := requestBodyContent[mediaType].Schema; schemaRef != nil {
					if err := validator(requestBody, schemaRef.Value); err != nil {
						return fmt.Errorf("custom validation failed for %s: %w", validatorName, err)
					}
				}
			}
		}
	}

	return nil
}

// createCustomParamDecoder creates a custom parameter decoder
func (vm *ValidationMiddleware) createCustomParamDecoder() openapi3filter.ContentParameterDecoder {
	return &customParamDecoder{
		customValidators: vm.config.CustomValidators,
	}
}

// handleValidationError handles validation errors
func (vm *ValidationMiddleware) handleValidationError(w http.ResponseWriter, r *http.Request, validationType string, err error) {
	vm.metrics.ValidationErrors++

	vm.logger.WithFields(logrus.Fields{
		"error":           err.Error(),
		"validation_type": validationType,
		"path":            r.URL.Path,
		"method":          r.Method,
		"user_agent":      r.Header.Get("User-Agent"),
		"ip":              r.RemoteAddr,
	}).Warn("API validation failed")

	// Prepare error response
	statusCode := http.StatusBadRequest
	if validationType == "response" {
		statusCode = http.StatusInternalServerError
	}

	render.Status(r, statusCode)
	render.JSON(w, r, map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    "VALIDATION_ERROR",
			"message": vm.formatValidationErrorMessage(err, validationType),
			"details": vm.extractValidationDetails(err),
			"type":    validationType,
		},
		"meta": map[string]interface{}{
			"request_id": uuid.New().String(),
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
			"version":    "v1",
		},
	})
}

// handleRouteNotFound handles cases where route is not found in OpenAPI spec
func (vm *ValidationMiddleware) handleRouteNotFound(w http.ResponseWriter, r *http.Request, err error) {
	vm.logger.WithFields(logrus.Fields{
		"error":      err.Error(),
		"path":       r.URL.Path,
		"method":     r.Method,
		"user_agent": r.Header.Get("User-Agent"),
		"ip":         r.RemoteAddr,
	}).Warn("Route not found in OpenAPI specification")

	render.Status(r, http.StatusNotFound)
	render.JSON(w, r, map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    "ROUTE_NOT_FOUND",
			"message": "The requested endpoint is not available in the current API specification",
			"details": map[string]interface{}{
				"path":   r.URL.Path,
				"method": r.Method,
			},
		},
		"meta": map[string]interface{}{
			"request_id": uuid.New().String(),
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
			"version":    "v1",
		},
	})
}

// formatValidationErrorMessage formats validation error messages
func (vm *ValidationMiddleware) formatValidationErrorMessage(err error, validationType string) string {
	switch validationType {
	case "request":
		return "Request validation failed. Please check your request parameters and body."
	case "response":
		return "Response validation failed. The server returned an invalid response format."
	case "custom":
		return "Custom validation failed. The request does not meet the required business rules."
	default:
		return "Validation failed."
	}
}

// extractValidationDetails extracts detailed validation information
func (vm *ValidationMiddleware) extractValidationDetails(err error) []ValidationError {
	var details []ValidationError

	// Try to extract OpenAPI validation errors
	if multiErr, ok := err.(openapi3.MultiError); ok {
		for _, e := range multiErr {
			if paramErr, ok := e.(*openapi3filter.InvalidParamError); ok {
				details = append(details, ValidationError{
					Field:   paramErr.Name,
					Message: paramErr.Reason,
					Value:   paramErr.Value,
					Code:    "INVALID_PARAMETER",
				})
			} else if reqErr, ok := e.(*openapi3filter.RequestError); ok {
				details = append(details, ValidationError{
					Field:   "request_body",
					Message: reqErr.Error(),
					Code:    "INVALID_REQUEST_BODY",
				})
			}
		}
	} else {
		// Generic error
		details = append(details, ValidationError{
			Field:   "general",
			Message: err.Error(),
			Code:    "VALIDATION_FAILED",
		})
	}

	return details
}

// writeResponse writes the captured response
func (vm *ValidationMiddleware) writeResponse(w http.ResponseWriter, rw *validationResponseWriter) {
	// Copy headers
	for key, values := range rw.Header() {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Write status code
	w.WriteHeader(rw.statusCode)

	// Write body
	if rw.buffer.Len() > 0 {
		w.Write(rw.buffer.Bytes())
	}
}

// GetMetrics returns validation metrics
func (vm *ValidationMiddleware) GetMetrics() ValidationMetrics {
	return vm.metrics
}

// validationResponseWriter captures response data for validation
type validationResponseWriter struct {
	http.ResponseWriter
	buffer     *bytes.Buffer
	statusCode int
	written    bool
}

// WriteHeader captures the status code
func (rw *validationResponseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
}

// Write captures the response body
func (rw *validationResponseWriter) Write(data []byte) (int, error) {
	rw.written = true
	return rw.buffer.Write(data)
}

// customParamDecoder implements custom parameter decoding
type customParamDecoder struct {
	customValidators map[string]CustomValidator
}

// DecodeParameter decodes parameters with custom validation
func (cpd *customParamDecoder) DecodeParameter(param *openapi3.Parameter, values []string) (interface{}, *openapi3.Schema, error) {
	// Use default decoder first
	decoder := &openapi3filter.DefaultContentParameterDecoder{}
	value, schema, err := decoder.DecodeParameter(param, values)
	if err != nil {
		return nil, nil, err
	}

	// Apply custom validators if available
	if validator, ok := cpd.customValidators[param.Name]; ok && schema != nil {
		if err := validator(value, schema); err != nil {
			return nil, nil, fmt.Errorf("custom validation failed for parameter %s: %w", param.Name, err)
		}
	}

	return value, schema, nil
}

// Context keys for validation
const (
	RouteKey      contextKey = "openapi_route"
	PathParamsKey contextKey = "openapi_path_params"
)

// GetRoute retrieves the OpenAPI route from context
func GetRoute(ctx context.Context) (*legacy.Route, bool) {
	route, ok := ctx.Value(RouteKey).(*legacy.Route)
	return route, ok
}

// GetPathParams retrieves the path parameters from context
func GetPathParams(ctx context.Context) (map[string]string, bool) {
	params, ok := ctx.Value(PathParamsKey).(map[string]string)
	return params, ok
}

// Built-in custom validators

// EmailValidator validates email formats
func EmailValidator(value interface{}, schema *openapi3.Schema) error {
	if str, ok := value.(string); ok {
		emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
		if !emailRegex.MatchString(str) {
			return fmt.Errorf("invalid email format: %s", str)
		}
	}
	return nil
}

// UUIDValidator validates UUID formats
func UUIDValidator(value interface{}, schema *openapi3.Schema) error {
	if str, ok := value.(string); ok {
		if _, err := uuid.Parse(str); err != nil {
			return fmt.Errorf("invalid UUID format: %s", str)
		}
	}
	return nil
}

// PasswordValidator validates password strength
func PasswordValidator(value interface{}, schema *openapi3.Schema) error {
	if str, ok := value.(string); ok {
		if len(str) < 8 {
			return fmt.Errorf("password must be at least 8 characters long")
		}

		// Check for at least one uppercase letter
		if !regexp.MustCompile(`[A-Z]`).MatchString(str) {
			return fmt.Errorf("password must contain at least one uppercase letter")
		}

		// Check for at least one lowercase letter
		if !regexp.MustCompile(`[a-z]`).MatchString(str) {
			return fmt.Errorf("password must contain at least one lowercase letter")
		}

		// Check for at least one digit
		if !regexp.MustCompile(`\d`).MatchString(str) {
			return fmt.Errorf("password must contain at least one digit")
		}

		// Check for at least one special character
		if !regexp.MustCompile(`[!@#$%^&*(),.?":{}|<>]`).MatchString(str) {
			return fmt.Errorf("password must contain at least one special character")
		}
	}
	return nil
}

// TenantIDValidator validates tenant ID format and access
func TenantIDValidator(value interface{}, schema *openapi3.Schema) error {
	if str, ok := value.(string); ok {
		if _, err := uuid.Parse(str); err != nil {
			return fmt.Errorf("invalid tenant ID format: %s", str)
		}

		// Additional tenant-specific validation can be added here
		// For example, checking if tenant exists, is active, etc.
	}
	return nil
}

// PhoneNumberValidator validates phone number formats
func PhoneNumberValidator(value interface{}, schema *openapi3.Schema) error {
	if str, ok := value.(string); ok {
		// Remove all non-digit characters
		digitsOnly := regexp.MustCompile(`\D`).ReplaceAllString(str, "")

		// Check if it's a valid phone number (10-15 digits)
		if len(digitsOnly) < 10 || len(digitsOnly) > 15 {
			return fmt.Errorf("invalid phone number format: %s", str)
		}
	}
	return nil
}

// DefaultCustomValidators returns a map of default custom validators
func DefaultCustomValidators() map[string]CustomValidator {
	return map[string]CustomValidator{
		"email":        EmailValidator,
		"uuid":         UUIDValidator,
		"password":     PasswordValidator,
		"tenant_id":    TenantIDValidator,
		"phone_number": PhoneNumberValidator,
	}
}
