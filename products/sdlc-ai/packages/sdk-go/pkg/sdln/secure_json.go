package sdln

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

// SecureJSONUnmarshaler provides secure JSON unmarshaling with validation
type SecureJSONUnmarshaler struct {
	maxSize       int64
	allowedTypes  map[string]bool
	sanitizeInput bool
}

// NewSecureJSONUnmarshaler creates a new secure JSON unmarshaler
func NewSecureJSONUnmarshaler() *SecureJSONUnmarshaler {
	return &SecureJSONUnmarshaler{
		maxSize:       10 * 1024 * 1024, // 10MB default
		allowedTypes:  make(map[string]bool),
		sanitizeInput: true,
	}
}

// WithMaxSize sets the maximum JSON size to unmarshal
func (s *SecureJSONUnmarshaler) WithMaxSize(size int64) *SecureJSONUnmarshaler {
	s.maxSize = size
	return s
}

// WithAllowedTypes sets allowed types for unmarshaling
func (s *SecureJSONUnmarshaler) WithAllowedTypes(types ...interface{}) *SecureJSONUnmarshaler {
	s.allowedTypes = make(map[string]bool)
	for _, t := range types {
		typeName := reflect.TypeOf(t).String()
		s.allowedTypes[typeName] = true
	}
	return s
}

// WithSanitization enables/disables input sanitization
func (s *SecureJSONUnmarshaler) WithSanitization(enabled bool) *SecureJSONUnmarshaler {
	s.sanitizeInput = enabled
	return s
}

// SecureUnmarshal securely unmarshals JSON data with validation
func (s *SecureJSONUnmarshaler) SecureUnmarshal(data []byte, v interface{}) error {
	// Validate input size
	if int64(len(data)) > s.maxSize {
		return fmt.Errorf("JSON data exceeds maximum size limit of %d bytes", s.maxSize)
	}

	// Sanitize input if enabled
	if s.sanitizeInput {
		data = s.sanitizeJSON(data)
	}

	// Validate JSON structure before unmarshaling
	if err := s.validateJSONStructure(data); err != nil {
		return fmt.Errorf("invalid JSON structure: %w", err)
	}

	// Check if target type is allowed
	if len(s.allowedTypes) > 0 {
		targetType := reflect.TypeOf(v).Elem().String()
		if !s.allowedTypes[targetType] {
			return fmt.Errorf("type %s is not allowed for unmarshaling", targetType)
		}
	}

	// Perform safe unmarshaling
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()

	return decoder.Decode(v)
}

// sanitizeJSON removes potentially dangerous content from JSON
func (s *SecureJSONUnmarshaler) sanitizeJSON(data []byte) []byte {
	// Remove null bytes and other control characters
	sanitized := make([]byte, 0, len(data))
	for _, b := range data {
		if b >= 32 && b <= 126 || b == 9 || b == 10 || b == 13 {
			sanitized = append(sanitized, b)
		}
	}
	return sanitized
}

// validateJSONStructure performs basic JSON structure validation
func (s *SecureJSONUnmarshaler) validateJSONStructure(data []byte) error {
	var js interface{}
	if err := json.Unmarshal(data, &js); err != nil {
		return err
	}

	// Recursively validate the JSON structure
	return s.validateValue(js)
}

// validateValue recursively validates JSON values
func (s *SecureJSONUnmarshaler) validateValue(v interface{}) error {
	switch val := v.(type) {
	case string:
		// Check for potentially dangerous strings
		if strings.Contains(val, "<script") || strings.Contains(val, "javascript:") {
			return fmt.Errorf("potentially dangerous content detected in string")
		}
		if len(val) > 10000 { // Max string length
			return fmt.Errorf("string value exceeds maximum length")
		}
	case map[string]interface{}:
		// Check map depth and size
		if len(val) > 1000 { // Max number of fields
			return fmt.Errorf("object has too many fields")
		}
		for key, value := range val {
			if len(key) > 1000 { // Max key length
				return fmt.Errorf("object key exceeds maximum length")
			}
			if err := s.validateValue(value); err != nil {
				return fmt.Errorf("error in field '%s': %w", key, err)
			}
		}
	case []interface{}:
		// Check array length
		if len(val) > 10000 { // Max array length
			return fmt.Errorf("array has too many elements")
		}
		for i, item := range val {
			if err := s.validateValue(item); err != nil {
				return fmt.Errorf("error at array index %d: %w", i, err)
			}
		}
	}
	return nil
}

// SecureUnmarshal is a convenience function for secure JSON unmarshaling
func SecureUnmarshal(data []byte, v interface{}) error {
	unmarshaler := NewSecureJSONUnmarshaler()
	return unmarshaler.SecureUnmarshal(data, v)
}

// SecureUnmarshalWithSize is a convenience function with size limit
func SecureUnmarshalWithSize(data []byte, v interface{}, maxSize int64) error {
	unmarshaler := NewSecureJSONUnmarshaler().WithMaxSize(maxSize)
	return unmarshaler.SecureUnmarshal(data, v)
}

// ValidateAPIResponse validates and unmarshals API responses securely
func ValidateAPIResponse(data []byte, result interface{}) error {
	unmarshaler := NewSecureJSONUnmarshaler().
		WithMaxSize(5 * 1024 * 1024). // 5MB limit for API responses
		WithSanitization(true)

	return unmarshaler.SecureUnmarshal(data, result)
}

// ValidateAPIError validates API error responses
func ValidateAPIError(data []byte) (*APIError, error) {
	var apiErr APIError
	unmarshaler := NewSecureJSONUnmarshaler().
		WithMaxSize(1024). // 1KB limit for error responses
		WithSanitization(true).
		WithAllowedTypes(APIError{})

	if err := unmarshaler.SecureUnmarshal(data, &apiErr); err != nil {
		return nil, fmt.Errorf("failed to unmarshal API error: %w", err)
	}

	return &apiErr, nil
}
