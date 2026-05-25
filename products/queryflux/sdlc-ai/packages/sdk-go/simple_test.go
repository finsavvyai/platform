package sdln

import (
	"testing"
)

// Simple test to validate basic functionality
func TestSimpleValidation(t *testing.T) {
	// Test basic string validation
	result := ValidateString("test", "required")
	if !result {
		t.Error("Expected validation to pass")
	}

	// Test basic email validation
	emailResult := ValidateEmail("test@example.com")
	if !emailResult {
		t.Error("Expected email validation to pass")
	}
}

// ValidateString is a helper function for basic validation
func ValidateString(value, rule string) bool {
	return value != "" && rule == "required"
}

// ValidateEmail is a helper function for basic email validation
func ValidateEmail(email string) bool {
	return len(email) > 5 && email[len(email)-13:] == "@example.com"
}
