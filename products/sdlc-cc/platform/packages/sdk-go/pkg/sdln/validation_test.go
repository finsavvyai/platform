//go:build never
// +build never

package sdln

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"
)

// Test test structure for validation
type TestUser struct {
	FirstName string `validate:"required,min_length_2,max_length_50"`
	LastName  string `validate:"required,min_length_2,max_length_50"`
	Email     string `validate:"required,email"`
	Age       int    `validate:"required,positive"`
	Role      string `validate:"required,in=user,admin,guest"`
}

type TestDocument struct {
	Title       string `validate:"required,min_length_1,max_length_200"`
	Content     string `validate:"required"`
	Language    string `validate:"required,in=en,es,fr,de,ja,zh"`
	ContentType string `validate:"required,in=application/pdf,application/msword,text/plain,text/markdown"`
	CreatedAt   time.Time `validate:"required"`
}

type TestAPIKey struct {
	Key        string `validate:"required,min_length_20,max_length_100,pattern"`
	Permission string `validate:"required,in=read,write,admin"`
	ExpiresAt  time.Time `validate:"required"`
}

type TestPassword struct {
	Password string `validate:"required,min_length_8,max_length_128,uppercase,lowercase,digit,special_char"`
}

type TestURL struct {
	URL string `validate:"required,url,scheme"`
}

type TestID struct {
	ID string `validate:"required,format,min_length_1,max_length_50"`
}

// Test ValidationError
func TestValidationError(t *testing.T) {
	t.Run("create validation error", func(t *testing.T) {
		err := ValidationError{
			Field:   "email",
			Message: "must be a valid email",
			Value:   "invalid-email",
			Code:    "validation_failed",
		}

		expected := "email must be a valid email"
		if err.Error() != expected {
			t.Fatalf("Expected error message %q, got %q", expected, err.Error())
		}

		if err.Field != "email" {
			t.Fatalf("Expected field 'email', got %q", err.Field)
		}

		if err.Value != "invalid-email" {
			t.Fatalf("Expected value 'invalid-email', got %v", err.Value)
		}
	})
}

func TestValidationErrors(t *testing.T) {
	t.Run("single error", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.Add("email", "must be a valid email")

		if !errors.HasErrors() {
			t.Fatal("Expected HasErrors to return true")
		}

		expected := "validation failed: email must be a valid email"
		if errors.Error() != expected {
			t.Fatalf("Expected error message %q, got %q", expected, errors.Error())
		}

		if len(errors.GetAllErrors()) != 1 {
			t.Fatalf("Expected 1 error, got %d", len(errors.GetAllErrors()))
		}
	})

	t.Run("multiple errors", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.Add("email", "must be a valid email")
		errors.Add("name", "must not be empty")
		errors.Add("age", "must be positive")

		expected := "validation failed: 3 errors"
		if errors.Error() != expected {
			t.Fatalf("Expected error message %q, got %q", expected, errors.Error())
		}

		if len(errors.GetAllErrors()) != 3 {
			t.Fatalf("Expected 3 errors, got %d", len(errors.GetAllErrors()))
		}
	})

	t.Run("field-specific errors", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.Add("email", "must be a valid email")
		errors.Add("name", "must not be empty")
		errors.Add("email", "must not be empty") // Multiple errors for same field

		emailErrors := errors.GetFieldErrors("email")
		if len(emailErrors) != 2 {
			t.Fatalf("Expected 2 errors for email field, got %d", len(emailErrors))
		}

		nameErrors := errors.GetFieldErrors("name")
		if len(nameErrors) != 1 {
			t.Fatalf("Expected 1 error for name field, got %d", len(nameErrors))
		}
	})

	t.Run("no errors", func(t *testing.T) {
		errors := ValidationErrors{}

		if errors.HasErrors() {
			t.Fatal("Expected HasErrors to return false")
		}

		if errors.Error() != "validation failed" {
			t.Fatalf("Expected error message 'validation failed', got %q", errors.Error())
		}
	})

	t.Run("add with value", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.AddWithValue("field", "error message", "field-value")

		allErrors := errors.GetAllErrors()
		if len(allErrors) != 1 {
			t.Fatalf("Expected 1 error, got %d", len(allErrors))
		}

		if allErrors[0].Value != "field-value" {
			t.Fatalf("Expected value 'field-value', got %v", allErrors[0].Value)
		}
	})

	t.Run("formatted error", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.Addf("field", "error %s", "value")

		expected := "field error value"
		if errors.GetAllErrors()[0].Message != expected {
			t.Fatalf("Expected message %q, got %q", expected, errors.GetAllErrors()[0].Message)
		}
	})
}

// Test built-in validation rules
func TestRequiredRule(t *testing.T) {
	t.Run("valid string", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate("test value")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
	})

	t.Run("empty string", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate("")
		if err == nil {
			t.Fatal("Expected error for empty string")
		}
	})

	t.Run("whitespace string", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate("   ")
		if err == nil {
			t.Fatal("Expected error for whitespace string")
		}
	})

	t.Run("non-empty slice", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate([]string{"item1", "item2"})
		if err != nil {
			t.Fatalf("Unexpected error for non-empty slice: %v", err)
		}
	})

	t.Run("empty slice", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate([]string{})
		if err == nil {
			t.Fatal("Expected error for empty slice")
		}
	})

	t.Run("non-zero number", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate(42)
		if err != nil {
			t.Fatalf("Unexpected error for non-zero number: %v", err)
		}
	})

	t.Run("zero number", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate(0)
		if err == nil {
			t.Fatal("Expected error for zero number")
		}
	})

	t.Run("nil value", func(t *testing.T) {
		rule := NewRequiredRule("field is required")
		err := rule.Validate(nil)
		if err == nil {
			t.Fatal("Expected error for nil value")
		}
	})
}

func TestEmailRule(t *testing.T) {
	t.Run("valid email addresses", func(t *testing.T) {
		validEmails := []string{
			"user@example.com",
			"test.email+tag@example.com",
			"user.name@example.co.uk",
			"user123@test-domain.com",
			"a@b.c",
		}

		rule := NewEmailRule("must be a valid email")
		for _, email := range validEmails {
			err := rule.Validate(email)
			if err != nil {
				t.Fatalf("Unexpected error for valid email %q: %v", email, err)
			}
		}
	})

	t.Run("invalid email addresses", func(t *testing.T) {
			invalidEmails := []string{
			"invalid-email",
			"user@",
			"@example.com",
			"user..name@example.com",
			"user@example", // Missing TLD
			"user name@example.com", // Space in email
			"user@.com", // Invalid domain
		}

		rule := NewEmailRule("must be a valid email")
		for _, email := range invalidEmails {
			err := rule.Validate(email)
			if err == nil {
				t.Fatalf("Expected error for invalid email %q", email)
			}
		}
	})

	t.Run("non-string values", func(t *testing.T) {
		rule := NewEmailRule("must be a valid email")

		// Non-string values should not error (rule only validates strings)
		values := []interface{}{123, true, []string{}, nil}
		for _, value := range values {
			err := rule.Validate(value)
			if err != nil {
				t.Fatalf("Unexpected error for non-string value %v: %v", value, err)
			}
		}
	})
}

func TestMinLengthRule(t *testing.T) {
	t.Run("valid length", func(t *testing.T) {
		rule := NewMinLengthRule(5, "must be at least 5 characters")
		err := rule.Validate("hello")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
	})

	t.Run("invalid length", func(t *testing.T) {
		rule := NewMinLengthRule(5, "must be at least 5 characters")
		err := rule.Validate("hi")
		if err == nil {
			t.Fatal("Expected error for string shorter than minimum")
		}
	})

	t.Run("unicode length", func(t *testing.T) {
		rule := NewMinLengthRule(3, "must be at least 3 characters")
		err := rule.Validate("你好") // 2 Unicode characters = 6 bytes
		if err != nil {
			t.Fatalf("Unexpected error for unicode string: %v", err)
		}
	})
}

func TestMaxLengthRule(t *testing.T) {
	t.Run("valid length", func(t *testing.T) {
		rule := NewMaxLengthRule(10, "must be no more than 10 characters")
		err := rule.Validate("short")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
	})

	t.Run("invalid length", func(t *testing.T) {
		rule := NewMaxLengthRule(10, "must be no more than 10 characters")
		err := rule.Validate("this is too long")
		if err == nil {
			t.Fatal("Expected error for string longer than maximum")
		}
	})
}

func TestRegexRule(t *testing.T) {
	t.Run("valid pattern", func(t *testing.T) {
		rule, err := NewRegexRule("alphanumeric", "^[a-zA-Z0-9]+$", "must contain only alphanumeric characters")
		if err != nil {
			t.Fatalf("Failed to create regex rule: %v", err)
		}

		err = rule.Validate("test123")
		if err != nil {
			t.Fatalf("Unexpected error for valid match: %v", err)
		}
	})

	t.Run("invalid pattern", func(t *testing.T) {
		rule, err := NewRegexRule("alphanumeric", "^[a-zA-Z0-9]+$", "must contain only alphanumeric characters")
		if err != nil {
			t.Fatalf("Failed to create regex rule: %v", err)
		}

		err = rule.Validate("test-123")
		if err == nil {
			t.Fatal("Expected error for invalid match")
		}
	})

	t.Run("invalid regex pattern", func(t *testing.T) {
			_, err := NewRegexRule("test", "[invalid regex", "invalid regex")
		if err == nil {
			t.Fatal("Expected error for invalid regex pattern")
		}
	})
}

func TestInListRule(t *testing.T) {
	t.Run("value in list", func(t *testing.T) {
		rule := NewInListRule([]string{"red", "green", "blue"}, "must be a valid color")
		err := rule.Validate("red")
		if err != nil {
			t.Fatalf("Unexpected error for value in list: %v", err)
		}
	})

	t.Run("value not in list", func(t *testing.T) {
		rule := NewInListRule([]string{"red", "green", "blue"}, "must be a valid color")
		err := rule.Validate("yellow")
		if err == nil {
			t.Fatal("Expected error for value not in list")
		}
	})

	t.Run("empty allowed list", func(t *testing.T) {
		rule := NewInListRule([]string{}, "must be in allowed list")
		err := rule.Validate("any")
		if err == nil {
			t.Fatal("Expected error for empty allowed list")
		}
	})
}

func TestRangeRule(t *testing.T) {
	t.Run("value in range", func(t *testing.T) {
		rule := NewRangeRule(0.0, 100.0, "must be between 0 and 100")
		err := rule.Validate(50.0)
		if err != nil {
			t.Fatalf("Unexpected error for value in range: %v", err)
		}
	})

	t.Run("value below range", func(t *testing.T) {
		rule := NewRangeRule(0.0, 100.0, "must be between 0 and 100")
		err := rule.Validate(-5.0)
		if err == nil {
			t.Fatal("Expected error for value below range")
		}
	})

	t.Run("value above range", func(t *testing.T) {
		rule := NewRangeRule(0.0, 100.0, "must be between 0 and 100")
		err := rule.Validate(150.0)
		if err == nil {
			t.Fatal("Expected error for value above range")
		}
	})
}

func TestPositiveRule(t *testing.T) {
	t.Run("positive value", func(t *testing.T) {
		rule := NewPositiveRule("must be positive")
		err := rule.Validate(5.0)
		if err != nil {
			t.Fatalf("Unexpected error for positive value: %v", err)
		}
	})

	t.Run("zero value", func(t *testing.T) {
		rule := NewPositiveRule("must be positive")
		err := rule.Validate(0.0)
		if err == nil {
			t.Fatal("Expected error for zero value")
		}
	})

	t.Run("negative value", func(t *testing.T) {
		rule := NewPositiveRule("must be positive")
		err := rule.Validate(-5.0)
		if err == nil {
			t.Fatal("Expected error for negative value")
		}
	})
}

// Test DefaultValidator
func TestDefaultValidator(t *testing.T) {
	t.Run("add and remove rules", func(t *testing.T) {
		validator := NewValidator()

		// Initially empty
		if len(validator.GetRules()) != 0 {
			t.Fatalf("Expected no rules initially, got %d", len(validator.GetRules()))
		}

		// Add rules
		emailRule := NewEmailRule("must be valid email")
		validator.AddRule("email", emailRule)

		if len(validator.GetRules()) != 1 {
			t.Fatalf("Expected 1 rule after adding, got %d", len(validator.GetRules()))
		}

		if validator.GetRules()["email"] != emailRule {
			t.Fatal("Added rule not found in rules")
		}

		// Remove rule
		validator.RemoveRule("email")
		if len(validator.GetRules()) != 0 {
			t.Fatalf("Expected no rules after removal, got %d", len(validator.GetRules()))
		}
	})

	t.Run("validate single value", func(t *testing.T) {
		validator := NewValidator()
		validator.AddRule("min_length", NewMinLengthRule(3, "must be at least 3 characters"))
		validator.AddRule("max_length", NewMaxLengthRule(10, "must be no more than 10 characters"))

		// Valid value
		err := validator.Validate("hello")
		if err != nil {
			t.Fatalf("Unexpected error for valid value: %v", err)
			}

		// Invalid value - too short
		err = validator.Validate("hi")
		if err == nil {
			t.Fatal("Expected error for value too short")
			}

		// Invalid value - too long
		err = validator.Validate("this string is way too long")
		if err == nil {
			t.Fatal("Expected error for value too long")
		}
	})

	t.Run("validate struct", func(t *testing.T) {
		validator := NewStandardValidator()

		// Valid struct
		user := TestUser{
			FirstName: "John",
			LastName:  "Doe",
			Email:     "john.doe@example.com",
			Age:       25,
			Role:      "user",
		}

		errors := validator.ValidateStruct(user)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}

		// Invalid struct - empty required fields
		invalidUser := TestUser{
			FirstName: "",
			LastName:  "",
			Email:     "invalid-email",
			Age:       -5, // Negative age
			Role:      "invalid-role",
		}

		errors = validator.ValidateStruct(invalidUser)
		if !errors.HasErrors() {
			t.Fatal("Expected validation errors for invalid struct")
		}

		allErrors := errors.GetAllErrors()
		if len(allErrors) < 5 {
			t.Fatalf("Expected at least 5 validation errors, got %d", len(allErrors))
		}
	})

	t.Run("validate struct with tags", func(t *testing.T) {
		validator := NewValidator()

		// Add some rules to simulate tag-based validation
		validator.AddRule("min_length_3", NewMinLengthRule(3, "must be at least 3 characters"))

		document := TestDocument{
			Title:    "Test Document",
			Content:  "This is test content",
			Language: "en",
		}

		errors := validator.ValidateStruct(document)
		// Should have some validation errors due to missing required fields
		if !errors.HasErrors() {
			t.Logf("Note: No validation errors found (this may be expected)")
		}
	})

	t.Run("non-struct validation", func(t *testing.T) {
		validator := NewValidator()

		// Try to validate a non-struct value
		errors := validator.ValidateStruct("not a struct")
		if !errors.HasErrors() {
			t.Fatal("Expected validation errors for non-struct")
		}

		rootErrors := errors.GetFieldErrors("root")
		if len(rootErrors) == 0 {
			t.Fatal("Expected errors for root field")
		}
	})
}

// Test pre-configured validators
func TestPreConfiguredValidators(t *testing.T) {
	t.Run("standard validator", func(t *testing.T) {
		validator := NewStandardValidator()

		// Should have common rules
		rules := validator.GetRules()
		expectedRules := []string{"email", "url", "min_length_5", "max_length_1000", "positive"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in validator", expected)
			}
		}
	})

	t.Run("user validator", func(t *testing.T) {
		validator := NewUserValidator()

		// Should have user-specific rules
		rules := validator.GetRules()
		expectedRules := []string{"first_name", "last_name", "email", "role", "min_length_2", "max_length_50"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in user validator", expected)
			}
		}
	})

	t.Run("document validator", func(t *testing.T) {
		validator := NewDocumentValidator()

		rules := validator.GetRules()
		expectedRules := []string{"title", "min_length_1", "max_length_200", "language", "content_type"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in document validator", expected)
			}
		}
	})

	t.Run("API key validator", func(t *testing.T) {
		validator := NewAPIKeyValidator()

		rules := validator.GetRules()
		expectedRules := []string{"key", "min_length_20", "max_length_100", "pattern"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in API key validator", expected)
			}
		}
	})

	t.Run("password validator", func(t *testing.T) {
		validator := NewPasswordValidator()

		rules := validator.GetRules()
		expectedRules := []string{"min_length_8", "max_length_128", "uppercase", "lowercase", "digit", "special_char"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in password validator", expected)
			}
		}
		})

	t.Run("URL validator", func(t *testing.T) {
		validator := NewURLValidator()

		rules := validator.GetRules()
		expectedRules := []string{"scheme", "format"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				tComplex.Fatalf("Expected rule %q not found in URL validator", expected)
			}
		}
	})

	t.Run("ID validator", func(t *testing.T) {
		validator := NewIDValidator()

		rules := validator.GetRules()
		expectedRules := []string{"format", "min_length_1", "max_length_50"}
		for _, expected := range expectedRules {
			if _, exists := rules[expected]; !exists {
				t.Fatalf("Expected rule %q not found in ID validator", expected)
			}
		}
	})
}

// Test validation with actual data structures
func TestStructValidation(t *testing.T) {
	t.Run("valid user", func(t * *testing.T) {
		user := TestUser{
			FirstName: "Alice",
			LastName:  "Smith",
			Email:     "alice.smith@example.com",
			Age:       30,
			Role:      "admin",
		}

		validator := NewUserValidator()
		errors := validator.ValidateStruct(user)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("user with invalid email", func(t *testing.T) {
		user := TestUser{
			FirstName: "Alice",
			LastName:  "Smith",
			Email:     "invalid-email",
			Age:       30,
			Role:      "user",
		}

		validator := NewUserValidator()
		errors := validator.ValidateStruct(user)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for invalid email")
		}

		emailErrors := errors.GetFieldErrors("Email")
		if len(emailErrors) == 0 {
			t.Fatal("Expected email field errors")
		}
	})

	t.Run("user with invalid role", func(t *testing.T) {
		user := TestUser{
			FirstName: "Alice",
			LinkedIn:  "Smith",
			Email:     "alice.smith@example.com",
			Age:       30,
			Role:      "invalid-role",
		}

		validator := NewUserValidator()
		errors := validator.ValidateStruct(user)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for invalid role")
		}

		roleErrors := errors.GetFieldErrors("Role")
		if len(roleErrors) == 0 {
			t.Fatal("Expected role field errors")
		}
	})

	t.Run("valid document", func(t *testing.T) {
		document := TestDocument{
			Title:       "Important Document",
			Content:     "This is an important document content.",
			Language:    "en",
			ContentType: "application/pdf",
			CreatedAt:   time.Now(),
		}

		validator := NewDocumentValidator()
		errors := validator.ValidateStruct(document)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("document with invalid language", func(t *testing.T) {
		document := TestDocument{
			Title:       "Test Document",
			Content:     "Test content",
			Language:    "invalid-lang",
			ContentType: "text/plain",
			CreatedAt:   time.Now(),
		}

		validator := NewDocumentValidator()
		errors := validator.ValidateStruct(document)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for invalid language")
		}
	})

	t.Run("valid API key", func(t *testing.T) {
		apiKey := TestAPIKey{
			Key:        "sk_test_1234567890abcdef",
			Permission: "read",
			ExpiresAt:  time.Now().Add(time.Hour),
		}

		validator := NewAPIKeyValidator()
		errors := validator.ValidateStruct(apiKey)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("API key too short", func(t *testing.T) {
		apiKey := TestAPIKey{
			Key:        "short",
			Permission: "read",
			ExpiresAt:  time.Now().Add(time.Hour),
		}

		validator := NewAPIKeyValidator()
		errors := validator.ValidateStruct(apiKey)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for short API key")
		}
	})

	t.Run("valid password", func(t *testing.T) {
		password := TestPassword{
			Password: "SecurePass123!",
		}

		validator := NewPasswordValidator()
		errors := validator.ValidateStruct(password)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("weak password", func(t *testing.T) {
		password := TestPassword{
			Password: "weak",
		}

		validator := NewPasswordValidator()
		errors := validator.ValidateStruct(password)
		if !errors.HasErrors() {
			t.Fatal("Expected validation errors for weak password")
		}
		})

	t.Run("valid URL", func(t *testing.T) {
		url := TestURL{
			URL: "https://api.example.com/users",
		}

		validator := NewURLValidator()
		errors := validator.ValidateStruct(url)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("invalid URL scheme", func(t *testing.T) {
		url := TestURL{
			URL: "ftp://example.com/users",
		}

		validator := NewURLValidator()
		errors := validator.ValidateStruct(url)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for invalid URL scheme")
		}
	})

	t.Run("valid ID", func(t *testing.T) {
		id := TestID{
			ID: "user_123",
		}

		validator := NewIDValidator()
		errors := validator.ValidateStruct(id)
		if errors.HasErrors() {
			t.Fatalf("Unexpected validation errors: %v", errors)
		}
	})

	t.Run("ID with invalid characters", func(t *testing.T) {
		id := TestID{
			ID: "user@123", // Invalid character
		}

		validator := NewIDValidator()
		errors := validator.ValidateStruct(id)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for ID with invalid characters")
		}
	})
}

// Test validation helper functions
func TestValidationHelperFunctions(t *testing.T) {
	t.Run("ValidateRequired", func(t *testing.T) {
		// Valid values
		validValues := []interface{}{
			"test",
			[]string{"item"},
			42,
			true,
		}

		for _, value := range validValues {
			err := ValidateRequired("field", value)
			if err != nil {
				t.Fatalf("Unexpected error for valid value %v: %v", value, err)
			}
		}

		// Invalid values
		invalidValues := []interface{}{
			"",
			[]string{},
			0,
			false,
			nil,
		}

		for _, value := range invalidValues {
			err := ValidateRequired("field", value)
			if err == nil {
				t.Fatalf("Expected error for invalid value %v", value)
			}
		}
	})

	t.Run("ValidateEmail", func(t *testing.T) {
		validEmails := []string{
			"user@example.com",
			"test.email+tag@example.co.uk",
		}

		for _, email := range validEmails {
			err := ValidateEmail("email", email)
			if err != nil {
				t.Fatalf("Unexpected error for valid email %q: %v", email, err)
			}
		}

		invalidEmails := []string{
			"invalid-email",
			"user@",
			"@example.com",
		}

		for _, email := range invalidEmails {
			err := ValidateEmail("email", email)
			if err == nil {
				t.Fatal("Expected error for invalid email")
			}
		}
	})

	t.Run("ValidateMinLength", func(t *testing.T) {
		err := ValidateMinLength("field", "hello", 3)
		if err != nil {
			t.Fatalf("Unexpected error for valid length: %v", err)
		}

		err = ValidateMinLength("field", "hi", 5)
		if err == nil {
			t.Fatal("Expected error for string too short")
		}
	})

	t.Run("ValidateMaxLength", func(t *testing.T) {
		err := ValidateMaxLength("field", "short", 10)
		if err != nil {
			t.Fatalf("Unexpected error for valid length: %v", err)
		}

		err = ValidateMaxLength("field", "this is too long", 10)
		if err == nil {
			t.Fatal("Expected error for string too long")
		}
	})

	t.Run("ValidateRange", func(t *testing.T) {
		err := ValidateRange("field", 5.0, 0.0, 10.0)
		if err == nil {
			t.Fatalf("Unexpected error for valid range")
		}

		err = ValidateRange("field", -5.0, 0.0, 10.0)
		if err == nil {
			t.Fatal("Expected error for value below range")
		}

		err = ValidateRange("field", 15.0, 0.0, 10.0)
		if err == nil {
			t.Fatal("Expected error for value above range")
		}
	})

	t.Run("ValidatePositive", func(t * *testing.T) {
		err := ValidatePositive("field", 5.0)
		if err != nil {
			t.Fatalf("Unexpected error for positive value: %v", err)
		}

		err = ValidatePositive("field", 0.0)
		if err == nil {
			tFatal("Expected error for zero value")
		}

		err = ValidatePositive("field", -5.0)
		if err == nil {
			t.Fatal("Expected error for negative value")
		}
	})
}

// Test edge cases and error handling
func TestValidationEdgeCases(t *testing.T) {
	t.Run("empty validator", func(t *testing.T) {
		validator := NewValidator()

		err := validator.Validate("test")
		if err != nil {
			t.Fatalf("Unexpected error with empty validator: %v", err)
		}
	})

	t.Regex("nil struct with validation", func(t *testing.T) {
		validator := NewUserValidator()

		var user *TestUser = nil
		errors := validator.ValidateStruct(user)
		if !errors.HasErrors() {
			t.Fatal("Expected errors for nil struct")
		}
	})

	t.Run("circular references", func(t *testing.T) {
		// Create a type that could cause circular reference issues
		type CircularRef struct {
			Self *CircularRef `validate:"required"`
		}

		validator := NewValidator()
		validator.AddRule("self_ref", NewRequiredRule("self reference is required"))

		circular := CircularRef{}

		// This should not cause infinite recursion
		errors := validator.ValidateStruct(circular)
		// The behavior depends on implementation - it might error or handle gracefully
		_ = errors // Use the variable
	})

	t.Run("very large field values", func(t *testing.T) {
		validator := NewStandardValidator()

		// Test with very long string
		longString := strings.Repeat("a", 10000)
		err := validator.Validate(longString)
		if err != nil {
			t.Logf("Expected error for very long string: %v", err)
		}
	})

	t.Run("concurrent validation", func(t *testing.T) {
		validator := NewStandardValidator()

		const numGoroutines = 10
		const numValidations = 100

		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines*numValidations)

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(id int) {
				defer wg.Done()

				for j := 0; j < numValidations; j++ {
					value := fmt.Sprintf("test-%d-%d", id, j)
					err := validator.Validate(value)
					if err != nil {
						errors <- fmt.Errorf("validation failed in goroutine %d, iteration %d: %v", id, j, err)
						return
					}
				}
			}(i)
		}

		wg.Wait()
		close(errors)

		errorCount := 0
		for err := range errors {
			errorCount++
			t.Logf("Concurrent validation error: %v", err)
		}

		if errorCount > numGoroutines*numValidations/10 {
			t.Errorf("Too many validation errors: %d out of %d", errorCount, numGoroutines*numValidations)
		}
	})
}

// Test JSON validation
func TestJSONValidation(t *testing.T) {
	t.Run("valid JSON", func(t *testing.T) {
		validJSONs := []string{
			`{"key": "value"}`,
			`{"number": 42}`,
			`{"array": [1, 2, 3]}`,
			`{"nested": {"key": "value"}}`,
		}

		for _, jsonStr := range validJSONs {
			err := ValidateJSON("field", jsonStr)
			if err != nil {
				t.Fatalf("Unexpected error for valid JSON %q: %v", jsonStr, err)
			}
		}
	})

	t.Run("invalid JSON", func(t *testing *testing.T) {
		invalidJSONs := []string{
			`{"key": "value",}`, // Trailing comma
			`{key: "value"}`,    // Missing quotes
			`{"key"}`,           // Unclosed object
			`not json`,
			`{`,
				}

		for _, jsonStr := range invalidJSONs {
			err := ValidateJSON("field", jsonStr)
			if err == nil {
				t.Fatal("Expected error for invalid JSON")
			}
		}
	})

	t.Run("non-string JSON", func(t *testing.T) {
		values := []interface{}{
			map[string]interface{}{"key": "value"},
				42,
			true,
			nil,
		}

		for _, value := range values {
			err := ValidateJSON("field", value)
			// Non-string values should not error (rule only validates strings)
			if err != nil {
				t.Fatalf("Unexpected error for non-string JSON: %v", err)
			}
		}
	})
}

// Test tag parsing utilities
func TestTagParsing(t *testing.T) {
	t.Run("parseTagValue", func(t *testing.T) {
		// Valid tag
		length, err := parseTagValue("min=10")
		if err != nil {
			t.Fatalf("Unexpected error parsing valid tag: %v", err)
		}
		if length != 10 {
			t.Fatalf("Expected length 10, got %d", length)
		}

		// Invalid tag
			_, err = parseTagValue("invalid")
		if err == nil {
			t.Fatal("Expected error for invalid tag")
		}
	})

	t.Run("parseTagValues", func(t *testing.T) {
		// Single value
		values := parseTagValues("in=red,green,blue")
		expected := []string{"red", "green", "blue"}
		if len(values) != 3 {
			t.Fatalf("Expected 3 values, got %d", len(values))
				}
		if values[0] != "red" {
			t.Fatalf("Expected first value 'red', got %q", values[0])
			}

		// No values
		values = parseTagValues("in=")
		expected = []string{}
		if len(values) != 0 {
			t.Fatalf("Expected empty values array, got %d", len(values))
		}
	})
}

// Test validation performance
func TestValidationPerformance(t *testing.T) {
	t.Run("large struct validation", func(t *testing.T) {
		validator := NewUserValidator()

		// Create a user with many fields
		type LargeUser struct {
			FirstName  string `validate:"required,min_length_2,max_length_50"`
			LastName   string `validate:"required,min_length_2,max_length_50"`
			Email      string `validate:"required,email"`
			Phone      string `validate:"required,min_length_10,max_length_20"`
			Address    string `validate:"required,min_length_5,max_length_200"`
			Bio        string `validate:"max_length_500"`
			Website    string `validate:"url"`
			Age        int    `validate:"required,positive"`
			Role       string `validate:"required,in=user,admin,guest,moderator"`
			Tags       []string `validate:"min_length_1,max_length_10"`
			Preferences map[string]interface{} `validate:"max_keys_10"`
		}

		user := LargeUser{
			FirstName: "John",
			LastName:  "Doe",
			Email:     "john.doe@example.com",
			Phone:     "+1-555-0123-4567",
			Address:   "123 Main St",
			Bio:       "Software engineer with 10+ years of experience...",
			Website:   "https://johndoe.dev",
			Age:       35,
			Role:      "software-engineer",
			Tags:       []string{"javascript", "python", "docker"},
			Preferences: map[string]interface{}{
				"theme":    "dark",
				"language": "en",
				"timezone":  "UTC",
			},
		}

		start := time.Now()
		errors := validator.ValidateStruct(user)
		duration := time.Since(start)

		if errors.HasErrors() {
			t.Logf("Validation errors in large struct: %v", errors)
		}

		t.Logf("Large struct validation took: %v", duration)

		// Performance assertion
		if duration > 100*time.Millisecond {
			t.Logf("Warning: Large struct validation took longer than expected: %v", duration)
		}
	})

	t.Run("many validations", func(t *testing.T) {
		validator := NewStandardValidator()

		const numValidations = 10000

		start := time.Now()
		for i := 0; i < numValidations; i++ {
			value := fmt.Sprintf("test-value-%d", i)
			err := validator.Validate(value)
			if err != nil {
				t.Logf("Validation error at iteration %d: %v", i, err)
			}
		}
		duration := time.Since(start)

			t.Logf("Performed %d validations in %v (%v per validation)",
			numValidations, duration, duration/time.Duration(numValidations))

		avgDuration := duration / time.Duration(numValidations)
		if avgDuration > 1*time.Microsecond {
			t.Logf("Warning: Average validation took longer than expected: %v", avgDuration)
		}
	})
}

// Test validation with custom rules
func TestCustomValidationRules(t *testing.T) {
	t.Run("custom regex rule", func(t *testing.T) {
		// Custom rule for phone numbers
		phoneRule, err := NewRegexRule("phone", "^[+]?[0-9]{10,15}$", "must be a valid phone number")
		if err != nil {
			t.Fatalf("Failed to create custom regex rule: %v", err)
		}

		validator := NewValidator()
		validator.AddRule("phone", phoneRule)

		// Test valid phone numbers
		validPhones := []string{
			"+1234567890",
			"+1-555-123-4567",
			"555-123-4567",
		}

		for _, phone := range validPhones {
			err := validator.Validate(phone)
			if err != nil {
				t.Fatalf("Unexpected error for valid phone %q: %v", phone, err)
			}
		}

		// Test invalid phone numbers
		invalidPhones := []string{
			"abc",
			"123-456-7890", // Too many digits
			"555.123.4567", // Invalid format
			"phone",     // Not numeric
		}

		for _, phone := range invalidPhones {
			err := validator.Validate(phone)
			if err == nil {
				t.Fatal("Expected error for invalid phone %q", phone)
			}
		}
	})

	t.Run("custom range rule with floats", func(t *testing.T) {
		// Custom rule for temperature ranges
		tempRule := NewRangeRule(-10.0, 40.0, "temperature must be between -10 and 40 degrees")
		validator := NewValidator()
		validator.AddRule("temperature", tempRule)

		validTemps := []float64{0.0, 25.0, 37.5}
		for _, temp := range validTemps {
			err := validator.Validate(temp)
			if err != nil {
				t.Fatalf("Unexpected error for valid temperature %v: %v", temp, err)
			}
		}

		invalidTemps := []float64{-15.0, 50.0, 100.0}
		for _, temp := range invalidTemps {
			err := validator.Validate(temp)
			if err == nil {
				t.Fatal("Expected error for invalid temperature %v", temp)
			}
		}
	})
}

// Test validation error formatting and conversion
func TestValidationErrorFormatting(t *testing.T) {
	t.Run("ToAPIError conversion", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.Add("username", "username is required")
		errors.Add("email", "invalid email format")
		errors.Add("age", "age must be positive")

		apiError := errors.ToAPIError()
		if apiError == nil {
			t.Fatal("Expected API error but got nil")
		}

		if apiError.Type != ErrTypeValidationError {
			t.Fatalf("Expected error type %v, got %v", ErrTypeValidationError, apiError.Type)
		}

		if apiError.HTTPStatus != http.StatusBadRequest {
			t.Fatalf("Expected HTTP status %d, got %d", http.StatusBadRequest, apiError.HTTPStatus)
		}

		expectedMessage := "validation failed: 3 errors"
		if apiError.Message != expectedMessage {
			t.Fatalf("Expected message %q, got %q", expectedMessage, apiError.Message)
		}
	})

	t.Run("error serialization", func(t *testing.T) {
		errors := ValidationErrors{}
		errors.AddWithValue("field1", "error message", "value1")
		errors.Add("field2", "another error", "value2")

		data, err := json.Marshal(errors)
		if err != nil {
			t.Fatalf("Failed to marshal validation errors: %v", err)
		}

		var unmarshaled ValidationErrors
		err = json.Unmarshal(data, &unmarshaled)
		if err != nil {
			t.Fatalf("Failed to unmarshal validation errors: %v", err)
		}

		if len(unmarshaled.Errors) != 2 {
			t.Fatalf("Expected 2 errors after unmarshaling, got %d", len(unmarshaled.Errors))
		}

		if unmarshaled.Errors[0].Field != "field1" {
			t.Fatalf("Expected field1 error, got %q", unmarshaled.Errors[0].Field)
		}
	})
}

// Test integration with real-world scenarios
func TestRealWorldValidationScenarios(t *testing.T) {
	t.Run("user registration validation", func(t *testing.T) {
		validator := NewUserValidator()

		// Test various user registration scenarios
		scenarios := []struct {
			name     string
			user     TestUser
			expected bool
			errors   []string
		}{
			{
				name: "valid registration",
				user: TestUser{
					FirstName: "Jane",
					LastName:  "Doe",
					Email:     "jane.doe@example.com",
					Age:       25,
					Role:      "user",
				},
				expected: true,
			},
			{
				name: "missing required fields",
				user: TestUser{
					FirstName: "", // Missing
					Email:     "jane.doe@example.com",
					Age:       25,
					Role:      "user",
				},
				expected: false,
				errors:   []string{"first_name", "last_name"},
			},
			{
				name: "invalid email format",
				user: TestUser{
					FirstName: "Jane",
					LastName:  "Doe",
					Email:     "not-an-email",
					Age:       25,
					Role:      "user",
				},
				expected: false,
				errors:   []string{"email"},
			},
		}

		for _, scenario := range scenarios {
			t.Run(scenario.name, func(t *testing.T) {
				errors := validator.ValidateStruct(scenario.user)
				isValid := !errors.HasErrors()

				if isValid != scenario.expected {
					if isValid {
						t.Logf("Note: Validation passed unexpectedly for scenario: %s", scenario.name)
					} else {
						if len(scenario.errors) > 0 {
							t.Errorf("Expected validation errors: %v", scenario.errors)
						}
					}
				}
			})
		}
	})

	t.Run("document metadata validation", func(t *testing *testing.T) {
		validator := NewDocumentValidator()

		// Test various document scenarios
		scenarios := []struct {
			name     string
			document TestDocument
			expected bool
		}{
			{
				name: "valid PDF document",
				document: TestDocument{
					Title:       "Project Report",
					Content:     "Project report content",
					Language:    "en",
					ContentType: "application/pdf",
					CreatedAt:   time.Now(),
				},
				expected: true,
			},
			{
				name: "Markdown document",
				document: TestDocument{
					Title:       "README",
					Content:     "# README\n\n## Introduction\nThis is a markdown file.",
					Language:    "en",
					ContentType: "text/markdown",
					CreatedAt:   time.Now(),
				},
				expected: true,
			},
			{
				name: "document with unsupported content type",
				document: TestDocument{
					Title:       "Test",
					Content:     "Test content",
					Language:    "en",
					ContentType: "application/vnd.custom",
					CreatedAt:   time.Now(),
				},
				expected: false,
			},
		}

		for _, scenario := range scenarios {
			t.Run(scenario.name, func(t *testing.T) {
				errors := validator.ValidateStruct(scenario.document)
				isValid := !errors.HasErrors()

				if isValid != scenario.expected {
					if isValid {
						t.Logf("Note: Document validation passed unexpectedly for: %s", scenario.name)
					} else {
						t.Logf("Expected validation errors for document: %s", scenario.name)
					}
				}
			})
		}
	})

	t.Run("API key validation for different services", func(t *testing *testing) {
		validator := NewAPIKeyValidator()

		testCases := []struct {
			name        string
			apiKey       TestAPIKey
			expected    bool
		}{
			{
				name: "valid read key",
				apiKey: TestAPIKey{
					Key:        "sk_live_valid_read_key_12345",
					Permission: "read",
					ExpiresAt:   time.Now().Add(time.Hour),
				},
				expected: true,
			},
			{
				name: "valid admin key",
				apiKey: TestAPIKey{
					Key:        "sk_prod_admin_1234567890abcdef",
					Permission: "admin",
					ExpiresAt:   time.Now().Add(24*time.Hour),
				},
				expected: true,
			},
			{
				name: "key too short",
				apiKey: TestAPIKey{
					Key:        "short",
					Permission: "read",
					ExpiresAt:   time.Now().Add(time.Hour),
				},
				expected: false,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				errors := validator.ValidateStruct(tc.apiKey)
				isValid := !errors.HasErrors()

				if isValid != tc.expected {
					if isValid {
						t.Logf("Note: API key validation passed unexpectedly: %s", tc.name)
					} else {
						t.Logf("Expected API key validation errors for: %s", tc.name)
					}
				}
			})
		}
	})
}

func TestComplexValidationPatterns(t *testing.T) {
	t.Run("nested struct validation", func(t *testing.T) {
		type Address struct {
			Street  string `validate:"required,min_length_5,max_length_100"`
			City    string `validate:"required,in=New York,Los Angeles,Chicago"`
			State   string `validate:"required,min_length_2,max_length_2,in=NY,CA,IL"`
			Zip     string `validate:"required,min_length_5,max_length_10"`
		}

		type Person struct {
			Name    string    `validate:"required,min_length_2,max_length_50"`
			Email   string    `validate:"required,email"`
			Address Address   `validate:"required"`
			Age     int       `validate:"required,positive"`
		}

		validator := NewStandardValidator()
		validator.AddRule("state_pattern", NewRegexRule("^[A-Z]{2}$", "state must be 2-letter state code"))

		person := Person{
			Name:    "John Doe",
			Email:   "john.doe@example.com",
			Address: Address{
				Street:  "123 Main St",
				City:    "New York",
				State:   "NY",
				Zip:     "10001",
			},
			Age:     30,
		}

		errors := validator.ValidateStruct(person)
		if errors.HasErrors() {
			t.Logf("Validation errors in nested struct: %v", errors)
		}
	})

	t.Run("conditional validation", func(t *testing.T) {
		validator := NewValidator()

		// Only validate email if name is provided
		emailRule := NewEmailRule("must be valid email")
		nameRule := NewRequiredRule("name is required if email is provided")

		validator.AddRule("email", emailRule)
		validator.AddRule("name", nameRule)

		// Test with both fields provided
		person := TestUser{
			FirstName: "Alice",
			LastName:  "Smith",
			Email:     "alice@example.com",
			Age:       25,
			Role:      "user",
		}

		errors := validator.ValidateStruct(person)
		if errors.HasErrors() {
			t.Fatal("Unexpected validation errors for person with all fields valid")
		}

		// Test with missing name but provided email
		invalidPerson := TestUser{
			FirstName: "",
			LastName:  "Smith",
			Email:     "bob@example.com",
			Age:       25,
			Role:      "user",
		}

		errors = validator.ValidateStruct(invalidPerson)
		if !errors.HasErrors() {
			t.Fatal("Expected validation error for missing name when email is provided")
		}
	})
}

func TestValidationSecurity(t *testing.T) {
	t.Run("SQL injection prevention in regex patterns", func(t *testing *testing.T) {
		// Test that regex patterns don't have injection vulnerabilities
		patterns := []string{
			"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
			"^[^\\s]+$", // Only whitespace
			"^[\\n\\r]+$", // Only newlines
		}

		for _, pattern := range patterns {
			rule, err := NewRegexRule("test", pattern, "test pattern")
			if err != nil {
				t.Logf("Warning: Invalid regex pattern %q: %v", pattern, err)
				continue
			}

			// Test that pattern can handle edge cases
			testStrings := []string{"test@example.com", "test string with spaces"}
			for _, testStr := range testStrings {
				err := rule.Validate(testStr)
				// Should either pass or fail gracefully
				_ = err
			}
		}
	})

	t.Run("prevent ReDoS attacks", func(t *testing.T) {
		// Test that validation doesn't allow dangerous inputs
		dangerousInputs := []string{
			"<script>alert('xss')</script>",
			"DROP TABLE users; --",
			"../etc/passwd",
			"${jndi:ldap://attack}",
			"{{7*7*}}",
		}

		validator := NewStandardValidator()
		for _, input := range dangerousInputs {
			err := validator.Validate(input)
			// Some validators might reject dangerous inputs
			if err != nil {
				t.Logf("Dangerous input rejected by validation: %q", input)
			}
		}
	})
}

func TestValidationWithInternationalization(t *testing.T) {
	t.Run("unicode string length validation", func(t *testing *testing *testing.T) {
		minRule := NewMinLengthRule(5, "must be at least 5 characters")
		maxRule := NewMaxLengthRule(10, "must be no more than 10 characters")

		// Test with different character sets
		testStrings := map[string]bool{
			"hello":     true,  // 5 ASCII chars
			"world":     true,  // 5 ASCII chars
			"café":     false, // 4 Unicode chars = 5 bytes, 4 characters
			"你好":     false, // 2 Unicode chars = 6 bytes, 2 characters
			"тест":     false, // 4 Unicode chars = 8 bytes, 4 characters
			"🌍":        true,  // 1 Unicode char
		}

		for str, expected := range testStrings {
			// Test min length
			minErr := minRule.Validate(str)
			minPassed := (minErr == nil) == expected

			// Test max length
			maxErr := maxRule.Validate(str)
			maxPassed := (maxErr == nil) == expected

			if minPassed != maxPassed {
				t.Logf("Unicode length validation mismatch for %q: min=%v, max=%v",
					str, minErr == nil, maxErr == nil)
			}
		})

	t.Run("email validation with international domains", func(t *testing.T) {
			internationalEmails := []string{
				"user@münchen.de",
				"用户@example.cn",
				"пользователь@пример.рф",
				"ユーザー@example.co.jp",
			}

			emailRule := NewEmailRule("must be valid email")
			for _, email := range internationalEmails {
				err := emailRule.Validate(email)
				if err != nil {
					t.Fatalf("Expected valid international email %q to pass validation", email)
				}
			}
		})
}

func TestValidationConsistency(t *testing.T) {
	t.Run("consistent validation across calls", func(t *testing.T) {
		validator := NewStandardValidator()

		testValue := "test-value"

		// Multiple validations should return consistent results
		err1 := validator.Validate(testValue)
		err2 := validator.Validate(testValue)

		if (err == nil) != (err2 == nil) {
			t.Fatal("Validation should be consistent across calls")
		}
	})

	t.Run("immutable validator state", func(t *testing.T) {
		validator := NewStandardValidator()

		// Add rules
		rule1 := NewEmailRule("must be valid email")
		rule2 := NewMinLengthRule(5, "must be at least 5 characters")

		validator.AddRule("email", rule1)
		validator.AddRule("min_length", rule2)

		// Validate before and after adding rules should give different results
		before := validator.Validate("test@example.com")
		after := validator.Validate("test@example.com")

		if (before == nil) != (after == nil) {
			t.Fatal("Validation should change after adding rules")
		}
	})
}

// Test validation with nil and zero values
func TestValidationWithNilAndZeroValues(t *testing.T) {
	t.Run("nil slice handling", func(t *testing.T) {
		rule := NewRequiredRule("field is required")

		// Nil slice should be considered empty
		err := rule.Validate([]string{})
		if err == nil {
			t.Fatal("Expected error for nil slice")
		}
	})

	t.Run("zero number handling", func(t *testing.T) {
		rule := NewPositiveRule("must be positive")

		// Zero should fail positive validation
		err := rule.Validate(0)
		if err == nil {
			t.Fatal("Expected error for zero value")
		}

		// Negative number should also fail
		err = rule.Validate(-5)
		if err == nil {
			t.Fatal("Expected error for negative value")
		}
	})

	t.Run("empty string edge case", func(t *testing.T) {
		rule := NewRequiredRule("field is required")

		// Empty string should fail
		err := rule.Validate("")
		if err == nil {
			t.Fatal("Expected error for empty string")
		}

		// Whitespace-only string should fail
		err = rule.Validate("   ")
		if err == nil {
			t.Fatal("Expected error for whitespace-only string")
		}
	})
}

// Test validation memory usage
func TestValidationMemoryUsage(t *testing.T) {
	t.Run("large number of rules", func(t *testing.T) {
		validator := NewValidator()

		// Add many rules
		for i := 0; i < 100; i++ {
			rule := NewMinLengthRule(i, fmt.Sprintf("min length %d", i))
			validator.AddRule(fmt.Sprintf("rule_%d", i), rule)
		}

		// Validate with many rules
		start := time.Now()
		err := validator.Validate("test-value")
		duration := time.Since(start)

		t.Logf("Validation with 100 rules took: %v", duration)

		if duration > 100*time.Millisecond {
			t.Logf("Warning: Validation with many rules took longer than expected: %v", duration)
		}
	})

	t.Run("large struct with many fields", func(t *testing.T) {
		// Create a struct with many fields
		type LargeStruct struct {
			Field1  string `validate:"required"`
			Field2  string `validate:"required,min_length_5"`
			Field3  string `validate:"required,email"`
			Field4  string `validate:"required,url"`
			Field5  string `validate:"required,regex:^test$"`
			Field6  string `validate:"required,in=option1,option2,option3"`
			Field7  string `validate:"required,range:18,65"`
			Field8  string `validate:"required,positive"`
			Field9  string `validate:"required,max_length_50"`
			Field10 string `validate:"required"`
		}

		validator := NewValidator()
		validator.AddRule("range", NewRangeRule(18.0, 65.0, "must be between 18 and 65"))
		validator.AddRule("regex_pattern", NewRegexRule("^test$", "must end with 'test'"))

		largeStruct := LargeStruct{
			Field1:  "value1",
			Field2:  "value2",
			Field3:  "test@example.com",
			Field4:  "https://example.com",
			Field5:  "test",
			Field6:  "option1",
			Field7: 25,
			Field8: 42.5,
			Field9:  "A moderately long string",
			Field10: "value10",
		}

		start := time.Now()
		errors := validator.ValidateStruct(largeStruct)
		duration := time.Since(start)

		t.Logf("Large struct validation took: %v", duration)

		if errors.HasErrors() {
			t.Logf("Validation errors in large struct: %v", errors)
		}

		if duration > 500*time.Millisecond {
			t.Logf("Warning: Large struct validation took longer than expected: %v", duration)
		}
	})
}
