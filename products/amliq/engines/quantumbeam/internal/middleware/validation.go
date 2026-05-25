package middleware

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

// ValidationMiddleware provides comprehensive request validation
type ValidationMiddleware struct {
	validator *validator.Validate
	config    *ValidationConfig
}

// ValidationConfig holds configuration for validation middleware
type ValidationConfig struct {
	EnableStructValidation bool                       `json:"enable_struct_validation"`
	EnableQueryValidation  bool                       `json:"enable_query_validation"`
	EnableHeaderValidation bool                       `json:"enable_header_validation"`
	MaxRequestSize         int64                      `json:"max_request_size"`
	StrictMode             bool                       `json:"strict_mode"`
	CustomValidators       map[string]CustomValidator `json:"custom_validators"`
	ValidationRules        map[string]ValidationRule  `json:"validation_rules"`
}

// CustomValidator defines a custom validation function
type CustomValidator func(interface{}) error

// ValidationRule defines validation rules for specific fields
type ValidationRule struct {
	Field      string      `json:"field"`
	Required   bool        `json:"required"`
	Type       string      `json:"type"`
	MinLength  *int        `json:"min_length,omitempty"`
	MaxLength  *int        `json:"max_length,omitempty"`
	Min        *float64    `json:"min,omitempty"`
	Max        *float64    `json:"max,omitempty"`
	Pattern    string      `json:"pattern,omitempty"`
	Enum       []string    `json:"enum,omitempty"`
	CustomFunc string      `json:"custom_func,omitempty"`
	DateFormat string      `json:"date_format,omitempty"`
	Transform  string      `json:"transform,omitempty"`
	Default    interface{} `json:"default,omitempty"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string      `json:"field"`
	Message string      `json:"message"`
	Value   interface{} `json:"value"`
	Rule    string      `json:"rule"`
}

// ValidationResult contains validation results
type ValidationResult struct {
	Valid    bool                   `json:"valid"`
	Errors   []ValidationError      `json:"errors,omitempty"`
	Warnings []ValidationError      `json:"warnings,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
}

// NewValidationMiddleware creates a new validation middleware
func NewValidationMiddleware(config *ValidationConfig) *ValidationMiddleware {
	if config == nil {
		config = &ValidationConfig{
			EnableStructValidation: true,
			EnableQueryValidation:  true,
			EnableHeaderValidation: false,
			MaxRequestSize:         1 << 20, // 1MB
			StrictMode:             false,
			CustomValidators:       make(map[string]CustomValidator),
			ValidationRules:        make(map[string]ValidationRule),
		}
	}

	v := validator.New()

	// Register custom validators
	v.RegisterValidation("transaction_amount", validateTransactionAmount)
	v.RegisterValidation("merchant_id", validateMerchantID)
	v.RegisterValidation("payment_method", validatePaymentMethod)
	v.RegisterValidation("user_id", validateUserID)
	v.RegisterValidation("risk_score", validateRiskScore)

	return &ValidationMiddleware{
		validator: v,
		config:    config,
	}
}

// Struct validates request body against struct tags
func (vm *ValidationMiddleware) Struct(obj interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !vm.config.EnableStructValidation {
			c.Next()
			return
		}

		if err := c.ShouldBindJSON(obj); err != nil {
			vm.handleValidationError(c, err)
			c.Abort()
			return
		}

		if err := vm.validator.Struct(obj); err != nil {
			vm.handleValidationError(c, err)
			c.Abort()
			return
		}

		// Apply custom validation rules
		if vm.hasValidationRules(c.Request.URL.Path) {
			result := vm.applyValidationRules(obj, c.Request.URL.Path)
			if !result.Valid {
				vm.handleCustomValidationError(c, result)
				c.Abort()
				return
			}
		}

		c.Set("validated_request", obj)
		c.Next()
	}
}

// Query validates query parameters
func (vm *ValidationMiddleware) Query(rules map[string]ValidationRule) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !vm.config.EnableQueryValidation {
			c.Next()
			return
		}

		result := &ValidationResult{
			Valid: true,
			Data:  make(map[string]interface{}),
		}

		for field, rule := range rules {
			value := c.Query(field)

			// Check if required field is missing
			if rule.Required && value == "" {
				if rule.Default != nil {
					value = fmt.Sprintf("%v", rule.Default)
				} else {
					result.Valid = false
					result.Errors = append(result.Errors, ValidationError{
						Field:   field,
						Message: fmt.Sprintf("Required query parameter '%s' is missing", field),
						Value:   value,
						Rule:    "required",
					})
					continue
				}
			}

			if value == "" {
				continue
			}

			// Validate field value
			if err := vm.validateField(value, rule); err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   field,
					Message: err.Error(),
					Value:   value,
					Rule:    rule.Type,
				})
				continue
			}

			// Transform and store validated value
			transformedValue, err := vm.transformValue(value, rule)
			if err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   field,
					Message: fmt.Sprintf("Failed to transform field '%s': %v", field, err),
					Value:   value,
					Rule:    "transform",
				})
				continue
			}

			result.Data[field] = transformedValue
		}

		if !result.Valid {
			vm.handleCustomValidationError(c, result)
			c.Abort()
			return
		}

		c.Set("validated_query", result.Data)
		c.Next()
	}
}

// Header validates request headers
func (vm *ValidationMiddleware) Header(rules map[string]ValidationRule) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !vm.config.EnableHeaderValidation {
			c.Next()
			return
		}

		result := &ValidationResult{
			Valid: true,
			Data:  make(map[string]interface{}),
		}

		for field, rule := range rules {
			value := c.GetHeader(field)

			// Check if required header is missing
			if rule.Required && value == "" {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   field,
					Message: fmt.Sprintf("Required header '%s' is missing", field),
					Value:   value,
					Rule:    "required",
				})
				continue
			}

			if value == "" {
				continue
			}

			// Validate header value
			if err := vm.validateField(value, rule); err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   field,
					Message: err.Error(),
					Value:   value,
					Rule:    rule.Type,
				})
				continue
			}

			result.Data[field] = value
		}

		if !result.Valid {
			vm.handleCustomValidationError(c, result)
			c.Abort()
			return
		}

		c.Set("validated_headers", result.Data)
		c.Next()
	}
}

// validateField validates a single field value against rules
func (vm *ValidationMiddleware) validateField(value string, rule ValidationRule) error {
	// Type validation
	switch rule.Type {
	case "string":
		return vm.validateString(value, rule)
	case "int":
		return vm.validateInt(value, rule)
	case "float":
		return vm.validateFloat(value, rule)
	case "bool":
		return vm.validateBool(value, rule)
	case "uuid":
		return vm.validateUUID(value, rule)
	case "email":
		return vm.validateEmail(value, rule)
	case "url":
		return vm.validateURL(value, rule)
	case "date":
		return vm.validateDate(value, rule)
	case "datetime":
		return vm.validateDateTime(value, rule)
	case "enum":
		return vm.validateEnum(value, rule)
	case "json":
		return vm.validateJSON(value, rule)
	case "base64":
		return vm.validateBase64(value, rule)
	}

	// Check for pattern matching
	if rule.Pattern != "" {
		return vm.validatePattern(value, rule.Pattern)
	}

	return nil
}

// Type-specific validation methods
func (vm *ValidationMiddleware) validateString(value string, rule ValidationRule) error {
	length := len(value)

	if rule.MinLength != nil && length < *rule.MinLength {
		return fmt.Errorf("minimum length is %d, got %d", *rule.MinLength, length)
	}

	if rule.MaxLength != nil && length > *rule.MaxLength {
		return fmt.Errorf("maximum length is %d, got %d", *rule.MaxLength, length)
	}

	return nil
}

func (vm *ValidationMiddleware) validateInt(value string, rule ValidationRule) error {
	intValue, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("must be an integer")
	}

	if rule.Min != nil && int64(intValue) < int64(*rule.Min) {
		return fmt.Errorf("minimum value is %.0f, got %d", *rule.Min, intValue)
	}

	if rule.Max != nil && int64(intValue) > int64(*rule.Max) {
		return fmt.Errorf("maximum value is %.0f, got %d", *rule.Max, intValue)
	}

	return nil
}

func (vm *ValidationMiddleware) validateFloat(value string, rule ValidationRule) error {
	floatValue, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fmt.Errorf("must be a number")
	}

	if rule.Min != nil && floatValue < *rule.Min {
		return fmt.Errorf("minimum value is %.2f, got %.2f", *rule.Min, floatValue)
	}

	if rule.Max != nil && floatValue > *rule.Max {
		return fmt.Errorf("maximum value is %.2f, got %.2f", *rule.Max, floatValue)
	}

	return nil
}

func (vm *ValidationMiddleware) validateBool(value string, rule ValidationRule) error {
	lower := strings.ToLower(value)
	if lower != "true" && lower != "false" && lower != "1" && lower != "0" {
		return fmt.Errorf("must be true or false")
	}
	return nil
}

func (vm *ValidationMiddleware) validateUUID(value string, rule ValidationRule) error {
	// Simple UUID validation (would use proper UUID library in production)
	if len(value) != 36 && len(value) != 32 {
		return fmt.Errorf("must be a valid UUID")
	}

	parts := strings.Split(value, "-")
	if len(parts) != 5 && len(parts) != 1 {
		return fmt.Errorf("must be a valid UUID")
	}

	return nil
}

func (vm *ValidationMiddleware) validateEmail(value string, rule ValidationRule) error {
	// Simple email validation (would use proper email validation in production)
	if !strings.Contains(value, "@") || !strings.Contains(value, ".") {
		return fmt.Errorf("must be a valid email address")
	}
	return nil
}

func (vm *ValidationMiddleware) validateURL(value string, rule ValidationRule) error {
	// Simple URL validation (would use proper URL validation in production)
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		return fmt.Errorf("must be a valid URL starting with http:// or https://")
	}
	return nil
}

func (vm *ValidationMiddleware) validateDate(value string, rule ValidationRule) error {
	format := rule.DateFormat
	if format == "" {
		format = "2006-01-02"
	}

	_, err := time.Parse(format, value)
	if err != nil {
		return fmt.Errorf("must be a valid date in format %s", format)
	}

	return nil
}

func (vm *ValidationMiddleware) validateDateTime(value string, rule ValidationRule) error {
	// Try common datetime formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05Z",
	}

	for _, format := range formats {
		if _, err := time.Parse(format, value); err == nil {
			return nil
		}
	}

	return fmt.Errorf("must be a valid datetime")
}

func (vm *ValidationMiddleware) validateEnum(value string, rule ValidationRule) error {
	for _, enumValue := range rule.Enum {
		if value == enumValue {
			return nil
		}
	}

	return fmt.Errorf("must be one of: %v", rule.Enum)
}

func (vm *ValidationMiddleware) validateJSON(value string, rule ValidationRule) error {
	// Simple JSON validation
	if !strings.HasPrefix(value, "{") && !strings.HasPrefix(value, "[") {
		return fmt.Errorf("must be valid JSON")
	}
	// Would use proper JSON validation in production
	return nil
}

func (vm *ValidationMiddleware) validateBase64(value string, rule ValidationRule) error {
	// Simple base64 validation (would use proper base64 validation in production)
	if len(value)%4 != 0 {
		return fmt.Errorf("must be valid base64")
	}
	return nil
}

func (vm *ValidationMiddleware) validatePattern(value, pattern string) error {
	// Would use proper regex validation in production
	return nil
}

// transformValue transforms field value according to rule
func (vm *ValidationMiddleware) transformValue(value string, rule ValidationRule) (interface{}, error) {
	if rule.Transform == "" {
		// Return appropriate type based on rule type
		switch rule.Type {
		case "int":
			return strconv.Atoi(value)
		case "float":
			return strconv.ParseFloat(value, 64)
		case "bool":
			return strconv.ParseBool(value)
		default:
			return value, nil
		}
	}

	switch rule.Transform {
	case "lowercase":
		return strings.ToLower(value), nil
	case "uppercase":
		return strings.ToUpper(value), nil
	case "trim":
		return strings.TrimSpace(value), nil
	case "slug":
		return strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(value, " ", "-"), "_", "-")), nil
	default:
		return value, nil
	}
}

// handleValidationError handles struct validation errors
func (vm *ValidationMiddleware) handleValidationError(c *gin.Context, err error) {
	var validationErrors []ValidationError

	if errs, ok := err.(validator.ValidationErrors); ok {
		for _, e := range errs {
			validationErrors = append(validationErrors, ValidationError{
				Field:   e.Field(),
				Message: vm.formatValidationError(e),
				Value:   e.Value(),
				Rule:    e.Tag(),
			})
		}
	} else {
		validationErrors = append(validationErrors, ValidationError{
			Field:   "request",
			Message: err.Error(),
			Value:   nil,
			Rule:    "general",
		})
	}

	c.JSON(http.StatusBadRequest, gin.H{
		"error":      "Validation failed",
		"message":    "Request validation failed",
		"code":       "VALIDATION_ERROR",
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
		"validation": validationErrors,
	})
}

// handleCustomValidationError handles custom validation errors
func (vm *ValidationMiddleware) handleCustomValidationError(c *gin.Context, result *ValidationResult) {
	c.JSON(http.StatusBadRequest, gin.H{
		"error":      "Validation failed",
		"message":    "Request validation failed",
		"code":       "VALIDATION_ERROR",
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
		"validation": result.Errors,
	})
}

// formatValidationError formats validator.FieldError into human-readable message
func (vm *ValidationMiddleware) formatValidationError(err validator.FieldError) string {
	field := err.Field()
	tag := err.Tag()
	param := err.Param()

	switch tag {
	case "required":
		return fmt.Sprintf("Field '%s' is required", field)
	case "min":
		return fmt.Sprintf("Field '%s' must be at least %s", field, param)
	case "max":
		return fmt.Sprintf("Field '%s' must be at most %s", field, param)
	case "len":
		return fmt.Sprintf("Field '%s' must be %s characters long", field, param)
	case "email":
		return fmt.Sprintf("Field '%s' must be a valid email address", field)
	case "url":
		return fmt.Sprintf("Field '%s' must be a valid URL", field)
	case "numeric":
		return fmt.Sprintf("Field '%s' must be numeric", field)
	case "alpha":
		return fmt.Sprintf("Field '%s' must contain only letters", field)
	case "alphanum":
		return fmt.Sprintf("Field '%s' must contain only letters and numbers", field)
	case "uuid":
		return fmt.Sprintf("Field '%s' must be a valid UUID", field)
	case "datetime":
		return fmt.Sprintf("Field '%s' must be a valid datetime", field)
	case "oneof":
		return fmt.Sprintf("Field '%s' must be one of: %s", field, param)
	case "transaction_amount":
		return "Transaction amount must be between 0.01 and 1000000.00"
	case "merchant_id":
		return "Merchant ID must be a valid UUID"
	case "payment_method":
		return "Payment method must be one of: credit_card, debit_card, bank_transfer, digital_wallet"
	case "user_id":
		return "User ID must be a valid UUID"
	case "risk_score":
		return "Risk score must be between 0.0 and 1.0"
	default:
		return fmt.Sprintf("Field '%s' failed validation: %s", field, tag)
	}
}

// hasValidationRules checks if there are validation rules for a path
func (vm *ValidationMiddleware) hasValidationRules(path string) bool {
	// Check for exact match
	if _, exists := vm.config.ValidationRules[path]; exists {
		return true
	}

	// Check for pattern match (simplified)
	for rulePath := range vm.config.ValidationRules {
		if strings.Contains(rulePath, "*") {
			pattern := strings.ReplaceAll(rulePath, "*", "")
			if strings.HasPrefix(path, pattern) {
				return true
			}
		}
	}

	return false
}

// applyValidationRules applies custom validation rules to validated object
func (vm *ValidationMiddleware) applyValidationRules(obj interface{}, path string) *ValidationResult {
	result := &ValidationResult{
		Valid: true,
	}

	rules, exists := vm.config.ValidationRules[path]
	if !exists {
		return result
	}

	// Use reflection to access struct fields
	val := reflect.ValueOf(obj)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	for field, rule := range rules {
		fieldValue := vm.getFieldValue(val, field)
		if err := vm.validateFieldValue(fieldValue, rule); err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   field,
				Message: err.Error(),
				Value:   fieldValue,
				Rule:    rule.Type,
			})
		}
	}

	return result
}

// getFieldValue extracts field value from struct using reflection
func (vm *ValidationMiddleware) getFieldValue(val reflect.Value, fieldName string) interface{} {
	if val.Kind() != reflect.Struct {
		return nil
	}

	field := val.FieldByName(fieldName)
	if !field.IsValid() {
		return nil
	}

	return field.Interface()
}

// validateFieldValue validates a field value against a rule
func (vm *ValidationMiddleware) validateFieldValue(value interface{}, rule ValidationRule) error {
	if value == nil {
		if rule.Required {
			return fmt.Errorf("field '%s' is required", rule.Field)
		}
		return nil
	}

	// Convert to string for validation
	strValue := fmt.Sprintf("%v", value)
	return vm.validateField(strValue, rule)
}

// Custom validation functions
func validateTransactionAmount(fl validator.FieldLevel) bool {
	amount := fl.Field().Float()
	return amount >= 0.01 && amount <= 1000000.00
}

func validateMerchantID(fl validator.FieldLevel) bool {
	merchantID := fl.Field().String()
	// Simple UUID validation for merchant ID
	return len(merchantID) == 36
}

func validatePaymentMethod(fl validator.FieldLevel) bool {
	method := fl.Field().String()
	validMethods := []string{"credit_card", "debit_card", "bank_transfer", "digital_wallet"}

	for _, validMethod := range validMethods {
		if method == validMethod {
			return true
		}
	}
	return false
}

func validateUserID(fl validator.FieldLevel) bool {
	userID := fl.Field().String()
	// Simple UUID validation for user ID
	return len(userID) == 36
}

func validateRiskScore(fl validator.FieldLevel) bool {
	score := fl.Field().Float()
	return score >= 0.0 && score <= 1.0
}

// Helper functions for common validation patterns

// Required returns a validation rule for required fields
func Required() ValidationRule {
	return ValidationRule{
		Required: true,
	}
}

// Optional returns a validation rule for optional fields
func Optional() ValidationRule {
	return ValidationRule{
		Required: false,
	}
}

// String returns a validation rule for string fields
func String(minLength, maxLength *int) ValidationRule {
	return ValidationRule{
		Type:      "string",
		MinLength: minLength,
		MaxLength: maxLength,
	}
}

// Int returns a validation rule for integer fields
func Int(min, max *float64) ValidationRule {
	return ValidationRule{
		Type: "int",
		Min:  min,
		Max:  max,
	}
}

// Float returns a validation rule for float fields
func Float(min, max *float64) ValidationRule {
	return ValidationRule{
		Type: "float",
		Min:  min,
		Max:  max,
	}
}

// Enum returns a validation rule for enum fields
func Enum(values ...string) ValidationRule {
	return ValidationRule{
		Type: "enum",
		Enum: values,
	}
}

// Date returns a validation rule for date fields
func Date(format string) ValidationRule {
	return ValidationRule{
		Type:       "date",
		DateFormat: format,
	}
}
