package sdln

import (
	"errors"
	"fmt"
	"net/mail"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// ========================================
// Validation Functions
// ========================================
// Validation types are in errors.go

// GetFieldErrors returns errors for a specific field
func (ve *ValidationErrors) GetFieldErrors(field string) []ValidationError {
	var errors []ValidationError
	for _, err := range ve.Errors {
		if err.Field == field {
			errors = append(errors, err)
		}
	}
	return errors
}

// GetAllErrors returns all validation errors
func (ve *ValidationErrors) GetAllErrors() []ValidationError {
	return ve.Errors
}

// ToAPIError is implemented in errors.go

// ========================================
// Validation Implementation
// ========================================
// Validator and ValidationRule interfaces are in interfaces.go

// RequiredRule validates that a value is not empty
type RequiredRule struct {
	name    string
	message string
}

// NewRequiredRule creates a new required rule
func NewRequiredRule(message string) *RequiredRule {
	return &RequiredRule{
		name:    "required",
		message: message,
	}
}

// Name returns the rule name
func (r *RequiredRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *RequiredRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *RequiredRule) Validate(value interface{}) error {
	if value == nil {
		return errors.New(r.message)
	}

	switch v := value.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return errors.New(r.message)
		}
	case []string:
		if len(v) == 0 {
			return errors.New(r.message)
		}
	case []interface{}:
		if len(v) == 0 {
			return errors.New(r.message)
		}
	default:
		// For other types, check if it's the zero value
		if reflect.DeepEqual(value, reflect.Zero(reflect.TypeOf(value)).Interface()) {
			return errors.New(r.message)
		}
	}

	return nil
}

// EmailRule validates email addresses
type EmailRule struct {
	name    string
	message string
}

// NewEmailRule creates a new email rule
func NewEmailRule(message string) *EmailRule {
	return &EmailRule{
		name:    "email",
		message: message,
	}
}

// Name returns the rule name
func (r *EmailRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *EmailRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *EmailRule) Validate(value interface{}) error {
	email, ok := value.(string)
	if !ok {
		return nil
	}

	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return errors.New(r.message)
	}

	return nil
}

// MinLengthRule validates minimum string length
type MinLengthRule struct {
	name    string
	minLen  int
	message string
}

// NewMinLengthRule creates a new minimum length rule
func NewMinLengthRule(minLen int, message string) *MinLengthRule {
	return &MinLengthRule{
		name:    "min_length",
		minLen:  minLen,
		message: message,
	}
}

// Name returns the rule name
func (r *MinLengthRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *MinLengthRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *MinLengthRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	if utf8.RuneCountInString(str) < r.minLen {
		return errors.New(r.message)
	}

	return nil
}

// MaxLengthRule validates maximum string length
type MaxLengthRule struct {
	name    string
	maxLen  int
	message string
}

// NewMaxLengthRule creates a new maximum length rule
func NewMaxLengthRule(maxLen int, message string) *MaxLengthRule {
	return &MaxLengthRule{
		name:    "max_length",
		maxLen:  maxLen,
		message: message,
	}
}

// Name returns the rule name
func (r *MaxLengthRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *MaxLengthRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *MaxLengthRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	if utf8.RuneCountInString(str) > r.maxLen {
		return errors.New(r.message)
	}

	return nil
}

// RegexRule validates using regular expressions
type RegexRule struct {
	name    string
	regex   *regexp.Regexp
	message string
}

// NewRegexRule creates a new regex rule
func NewRegexRule(name, pattern, message string) (*RegexRule, error) {
	regex, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}

	return &RegexRule{
		name:    name,
		regex:   regex,
		message: message,
	}, nil
}

// Name returns the rule name
func (r *RegexRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *RegexRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *RegexRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	if !r.regex.MatchString(str) {
		return errors.New(r.message)
	}

	return nil
}

// URLRule validates URLs
type URLRule struct {
	name    string
	message string
}

// NewURLRule creates a new URL rule
func NewURLRule(message string) *URLRule {
	return &URLRule{
		name:    "url",
		message: message,
	}
}

// Name returns the rule name
func (r *URLRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *URLRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *URLRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	_, err := mail.ParseAddressList(str)
	if err != nil {
		return errors.New(r.message)
	}

	return nil
}

// InListRule validates that a value is in a list of allowed values
type InListRule struct {
	name    string
	allowed []string
	message string
}

// NewInListRule creates a new in-list rule
func NewInListRule(allowed []string, message string) *InListRule {
	return &InListRule{
		name:    "in_list",
		allowed: allowed,
		message: message,
	}
}

// Name returns the rule name
func (r *InListRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *InListRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *InListRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	for _, allowed := range r.allowed {
		if str == allowed {
			return nil
		}
	}

	return errors.New(r.message)
}

// NotInListRule validates that a value is not in a list of disallowed values
type NotInListRule struct {
	name       string
	disallowed []string
	message    string
}

// NewNotInListRule creates a new not-in-list rule
func NewNotInListRule(disallowed []string, message string) *NotInListRule {
	return &NotInListRule{
		name:       "not_in_list",
		disallowed: disallowed,
		message:    message,
	}
}

// Name returns the rule name
func (r *NotInListRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *NotInListRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *NotInListRule) Validate(value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return nil
	}

	for _, disallowed := range r.disallowed {
		if str == disallowed {
			return errors.New(r.message)
		}
	}

	return nil
}

// RangeRule validates that a numeric value is within a range
type RangeRule struct {
	name    string
	min     interface{}
	max     interface{}
	message string
}

// NewRangeRule creates a new range rule
func NewRangeRule(min, max interface{}, message string) *RangeRule {
	return &RangeRule{
		name:    "range",
		min:     min,
		max:     max,
		message: message,
	}
}

// Name returns the rule name
func (r *RangeRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *RangeRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *RangeRule) Validate(value interface{}) error {
	num, ok := value.(float64)
	if !ok {
		return nil
	}

	min, _ := r.min.(float64)
	max, _ := r.max.(float64)

	if num < min || num > max {
		return errors.New(r.message)
	}

	return nil
}

// PositiveRule validates that a value is positive
type PositiveRule struct {
	name    string
	message string
}

// NewPositiveRule creates a new positive rule
func NewPositiveRule(message string) *PositiveRule {
	return &PositiveRule{
		name:    "positive",
		message: message,
	}
}

// Name returns the rule name
func (r *PositiveRule) Name() string {
	return r.name
}

// Message returns the rule message
func (r *PositiveRule) Message() string {
	return r.message
}

// Validate validates the value
func (r *PositiveRule) Validate(value interface{}) error {
	num, ok := value.(float64)
	if !ok {
		return nil
	}

	if num <= 0 {
		return errors.New(r.message)
	}

	return nil
}

// ========================================
// Validator Implementation
// ========================================

// DefaultValidator provides a default validator implementation
type DefaultValidator struct {
	rules map[string]ValidationRule
}

// NewValidator creates a new validator
func NewValidator() *DefaultValidator {
	return &DefaultValidator{
		rules: make(map[string]ValidationRule),
	}
}

// Validate validates a single value
func (v *DefaultValidator) Validate(value interface{}) error {
	for _, rule := range v.rules {
		if err := rule.Validate(value); err != nil {
			return err
		}
	}
	return nil
}

// ValidateStruct validates a struct
func (v *DefaultValidator) ValidateStruct(value interface{}) ValidationErrors {
	var errors ValidationErrors

	val := reflect.ValueOf(value)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		errors.Add("root", "value must be a struct", nil)
		return errors
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		fieldValue := val.Field(i)

		// Skip unexported fields
		if field.PkgPath != "" {
			continue
		}

		fieldName := field.Name
		fieldTag := field.Tag.Get("validate")

		if fieldTag == "-" {
			continue // Skip fields marked with validate:" -"
		}

		// Parse validation tags
		if fieldTag != "" {
			parts := strings.Split(fieldTag, ",")
			for _, part := range parts {
				switch part {
				case "required":
					errors.Add(fieldName, "field is required", nil)
				case "email":
					errors.Addf(fieldName, "must be a valid email address")
				case "url":
					errors.Addf(fieldName, "must be a valid URL")
				default:
					if strings.Contains(part, "min=") {
						minLen, err := parseTagValue(part)
						if err != nil {
							errors.Addf(fieldName, "invalid min length: %v", err)
						} else {
							errors.AddWithValue(fieldName,
								fmt.Sprintf("must be at least %d characters long", minLen))
						}
					} else if strings.Contains(part, "max=") {
						maxLen, err := parseTagValue(part)
						if err != nil {
							errors.Addf(fieldName, "invalid max length: %v", err)
						} else {
							errors.AddWithValue(fieldName,
								fmt.Sprintf("must be no more than %d characters long", maxLen))
						}
					} else if strings.Contains(part, "in=") {
						values := parseTagValues(part)
						if len(values) > 0 {
							rule := NewInListRule(values,
								fmt.Sprintf("must be one of: %v", values))
							errors.Add(fieldName, rule.Message(), nil)
						}
					} else if strings.Contains(part, "regex=") {
						pattern := strings.TrimPrefix(part, "regex=")
						rule, err := NewRegexRule(fieldName, pattern, "invalid format")
						if err != nil {
							errors.Addf(fieldName, "invalid regex pattern: %v", err)
						} else {
							errors.Add(fieldName, rule.Message(), nil)
						}
					}
				}
			}
		}

		// Validate the field value
		if err := v.Validate(fieldValue.Interface()); err != nil {
			errors.Add(fieldName, err.Error(), nil)
		}
	}

	return errors
}

// AddRule adds a validation rule
func (v *DefaultValidator) AddRule(name string, rule ValidationRule) {
	v.rules[name] = rule
}

// RemoveRule removes a validation rule
func (v *DefaultValidator) RemoveRule(name string) {
	delete(v.rules, name)
}

// GetRules returns all validation rules
func (v *DefaultValidator) GetRules() map[string]ValidationRule {
	return v.rules
}

// ========================================
// Validation Helper Functions
// ========================================

// ValidateRequired creates a validation error if the value is empty
func ValidateRequired(field, value interface{}) error {
	if value == nil || IsEmpty(ToString(value)) {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

// ValidateEmail creates a validation error if the value is not a valid email
func ValidateEmail(field, value interface{}) error {
	email, ok := value.(string)
	if !ok || !IsValidEmail(email) {
		return fmt.Errorf("%s must be a valid email address", field)
	}
	return nil
}

// ValidateMinLength creates a validation error if the string is too short
func ValidateMinLength(field, value string, minLen int) error {
	if len(value) < minLen {
		return fmt.Errorf("%s must be at least %d characters long", field, minLen)
	}
	return nil
}

// ValidateMaxLength creates a validation error if the string is too long
func ValidateMaxLength(field, value string, maxLen int) error {
	if len(value) > maxLen {
		return fmt.Errorf("%s must be no more than %d characters long", field, maxLen)
	}
	return nil
}

// ValidateRange creates a validation error if the number is not in range
func ValidateRange(field string, value float64, min, max float64) error {
	if value < min || value > max {
		return fmt.Errorf("%s must be between %.2f and %.2f", field, min, max)
	}
	return nil
}

// ValidatePositive creates a validation error if the number is not positive
func ValidatePositive(field string, value float64) error {
	if value <= 0 {
		return fmt.Errorf("%s must be positive", field)
	}
	return nil
}

// ValidateURL creates a validation error if the value is not a valid URL
// ValidateURL is implemented in secure_http.go

// ValidateJSON creates a validation error if the value is not valid JSON
func ValidateJSON(field, value interface{}) error {
	if str, ok := value.(string); ok {
		if !IsJSON(str) {
			return fmt.Errorf("%s must be valid JSON", field)
		}
	}
	return nil
}

// ========================================
// Tag Parsing Utilities
// ========================================

// parseTagValue extracts a numeric value from a tag like "min=10"
func parseTagValue(tag string) (int, error) {
	parts := strings.Split(tag, "=")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid tag format: %s", tag)
	}
	return strconv.Atoi(parts[1])
}

// parseTagValues extracts values from a tag like "in=value1,value2,value3"
func parseTagValues(tag string) []string {
	parts := strings.Split(tag, "=")
	if len(parts) < 2 {
		return []string{}
	}
	return parts[1:]
}

// ========================================
// Pre-configured Validators
// ========================================

// NewStandardValidator creates a validator with common rules
func NewStandardValidator() *DefaultValidator {
	validator := NewValidator()

	// Add common validation rules
	validator.AddRule("email", NewEmailRule("must be a valid email address"))
	validator.AddRule("url", NewURLRule("must be a valid URL"))
	validator.AddRule("min_length_5", NewMinLengthRule(5, "must be at least 5 characters"))
	validator.AddRule("max_length_1000", NewMaxLengthRule(1000, "must be no more than 1000 characters"))
	validator.AddRule("positive", NewPositiveRule("must be a positive number"))

	return validator
}

// NewUserValidator creates a validator for user data
func NewUserValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// User-specific rules
	validator.AddRule("first_name", NewRequiredRule("first name is required"))
	validator.AddRule("last_name", NewRequiredRule("last name is required"))
	validator.AddRule("email", NewEmailRule("must be a valid email address"))
	validator.AddRule("role", NewInListRule([]string{"user", "admin", "guest"}, "must be a valid role"))
	validator.AddRule("min_length_2", NewMinLengthRule(2, "name must be at least 2 characters"))
	validator.AddRule("max_length_50", NewMaxLengthRule(50, "name must be no more than 50 characters"))

	return validator
}

// NewDocumentValidator creates a validator for document metadata
func NewDocumentValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// Document-specific rules
	validator.AddRule("title", NewRequiredRule("title is required"))
	validator.AddRule("min_length_1", NewMinLengthRule(1, "title must be at least 1 character"))
	validator.AddRule("max_length_200", NewMaxLengthRule(200, "title must be no more than 200 characters"))
	validator.AddRule("language", NewInListRule([]string{"en", "es", "fr", "de", "ja", "zh"}, "must be a valid language code"))
	validator.AddRule("content_type", NewInListRule([]string{
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"text/plain",
		"text/markdown",
	}, "must be a supported content type"))

	return validator
}

// NewAPIKeyValidator creates a validator for API keys
func NewAPIKeyValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// API key rules
	validator.AddRule("key", NewRequiredRule("API key is required"))
	validator.AddRule("min_length_20", NewMinLengthRule(20, "API key must be at least 20 characters"))
	validator.AddRule("max_length_100", NewMaxLengthRule(100, "API key must be no more than 100 characters"))
	patternRule, _ := NewRegexRule("pattern", "^[a-zA-Z0-9_-]{20,100}$", "API key must contain only alphanumeric characters, hyphens, and underscores")
	validator.AddRule("pattern", patternRule)

	return validator
}

// NewPasswordValidator creates a validator for passwords
func NewPasswordValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// Password strength rules
	validator.AddRule("min_length_8", NewMinLengthRule(8, "password must be at least 8 characters"))
	validator.AddRule("max_length_128", NewMaxLengthRule(128, "password must be no more than 128 characters"))
	upper, _ := NewRegexRule("uppercase", "[A-Z]", "password must contain at least one uppercase letter")
	validator.AddRule("uppercase", upper)
	lower, _ := NewRegexRule("lowercase", "[a-z]", "password must contain at least one lowercase letter")
	validator.AddRule("lowercase", lower)
	digit, _ := NewRegexRule("digit", "[0-9]", "password must contain at least one digit")
	validator.AddRule("digit", digit)
	special, _ := NewRegexRule("special_char", "[!@#$%^&*()_+=\\[\\]{};':\"\\|,.<>?/~`]", "password must contain at least one special character")
	validator.AddRule("special_char", special)

	return validator
}

// NewURLValidator creates a validator for URLs
func NewURLValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// URL validation rules
	validator.AddRule("scheme", NewInListRule([]string{"http", "https"}, "URL must use http or https"))
	validator.AddRule("format", NewURLRule("must be a valid URL"))

	return validator
}

// NewIDValidator creates a validator for IDs
func NewIDValidator() *DefaultValidator {
	validator := NewStandardValidator()

	// ID validation rules
	idFormatRule, _ := NewRegexRule("format", "^[a-zA-Z0-9_-]+$", "ID must contain only alphanumeric characters, hyphens, and underscores")
	validator.AddRule("format", idFormatRule)
	validator.AddRule("min_length_1", NewMinLengthRule(1, "ID must be at least 1 character"))
	validator.AddRule("max_length_50", NewMaxLengthRule(50, "ID must be no more than 50 characters"))

	return validator
}
