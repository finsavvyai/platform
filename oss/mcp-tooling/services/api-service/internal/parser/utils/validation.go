package utils

import (
	"fmt"
	"regexp"
	"strings"
)

// IRValidator validates intermediate representations
type IRValidator struct {
	errors   []ValidationError
	warnings []ValidationError
}

// ValidationError represents a validation error
type ValidationError struct {
	Code     string      `json:"code"`
	Message  string      `json:"message"`
	Path     string      `json:"path,omitempty"`
	Severity string      `json:"severity"` // error, warning, info
	Details  interface{} `json:"details,omitempty"`
}

// NewIRValidator creates a new IR validator
func NewIRValidator() *IRValidator {
	return &IRValidator{
		errors:   []ValidationError{},
		warnings: []ValidationError{},
	}
}

// AddError adds an error
func (v *IRValidator) AddError(code, message, path string, details interface{}) {
	v.errors = append(v.errors, ValidationError{
		Code:     code,
		Message:  message,
		Path:     path,
		Severity: "error",
		Details:  details,
	})
}

// AddWarning adds a warning
func (v *IRValidator) AddWarning(code, message, path string, details interface{}) {
	v.warnings = append(v.warnings, ValidationError{
		Code:     code,
		Message:  message,
		Path:     path,
		Severity: "warning",
		Details:  details,
	})
}

// GetErrors returns all errors
func (v *IRValidator) GetErrors() []ValidationError {
	return v.errors
}

// GetWarnings returns all warnings
func (v *IRValidator) GetWarnings() []ValidationError {
	return v.warnings
}

// IsValid returns true if there are no errors
func (v *IRValidator) IsValid() bool {
	return len(v.errors) == 0
}

// ValidateMetadata validates API metadata
func (v *IRValidator) ValidateMetadata(name, version, title string) {
	if strings.TrimSpace(name) == "" {
		v.AddError("MISSING_NAME", "API name is required", "metadata.name", nil)
	}

	if strings.TrimSpace(version) == "" {
		v.AddError("MISSING_VERSION", "API version is required", "metadata.version", nil)
	}

	if strings.TrimSpace(title) == "" {
		v.AddWarning("MISSING_TITLE", "API title is recommended", "metadata.title", nil)
	}

	// Validate version format (semantic versioning recommended)
	if !isValidVersion(version) {
		v.AddWarning("INVALID_VERSION_FORMAT", 
			"Version should follow semantic versioning (e.g., 1.0.0)", 
			"metadata.version", 
			map[string]string{"version": version})
	}
}

// ValidateEndpoint validates an endpoint
func (v *IRValidator) ValidateEndpoint(id, name, method, path string, index int) {
	basePath := fmt.Sprintf("endpoints[%d]", index)

	if strings.TrimSpace(id) == "" {
		v.AddError("MISSING_ENDPOINT_ID", "Endpoint ID is required", basePath+".id", nil)
	}

	if strings.TrimSpace(name) == "" {
		v.AddError("MISSING_ENDPOINT_NAME", "Endpoint name is required", basePath+".name", nil)
	}

	if strings.TrimSpace(method) == "" {
		v.AddError("MISSING_METHOD", "HTTP method is required", basePath+".method", nil)
	} else if !isValidHTTPMethod(method) {
		v.AddError("INVALID_METHOD", 
			"Invalid HTTP method", 
			basePath+".method", 
			map[string]string{"method": method})
	}

	if strings.TrimSpace(path) == "" {
		v.AddError("MISSING_PATH", "Endpoint path is required", basePath+".path", nil)
	} else if !isValidPath(path) {
		v.AddWarning("INVALID_PATH_FORMAT", 
			"Path should start with /", 
			basePath+".path", 
			map[string]string{"path": path})
	}
}

// ValidateParameter validates a parameter
func (v *IRValidator) ValidateParameter(name, in string, required bool, index int, endpointPath string) {
	basePath := fmt.Sprintf("%s.parameters[%d]", endpointPath, index)

	if strings.TrimSpace(name) == "" {
		v.AddError("MISSING_PARAMETER_NAME", "Parameter name is required", basePath+".name", nil)
	}

	validLocations := []string{"path", "query", "header", "cookie", "body"}
	if !contains(validLocations, in) {
		v.AddError("INVALID_PARAMETER_LOCATION", 
			"Parameter location must be one of: path, query, header, cookie, body", 
			basePath+".in", 
			map[string]string{"location": in})
	}

	// Path parameters must be required
	if in == "path" && !required {
		v.AddWarning("PATH_PARAM_NOT_REQUIRED", 
			"Path parameters should be marked as required", 
			basePath+".required", 
			nil)
	}
}

// ValidateAuthScheme validates an authentication scheme
func (v *IRValidator) ValidateAuthScheme(id, authType string, index int) {
	basePath := fmt.Sprintf("auth[%d]", index)

	if strings.TrimSpace(id) == "" {
		v.AddError("MISSING_AUTH_ID", "Auth scheme ID is required", basePath+".id", nil)
	}

	validTypes := []string{"apiKey", "http", "oauth2", "openIdConnect", "custom"}
	if !contains(validTypes, authType) {
		v.AddError("INVALID_AUTH_TYPE", 
			"Auth type must be one of: apiKey, http, oauth2, openIdConnect, custom", 
			basePath+".type", 
			map[string]string{"type": authType})
	}
}

// ValidateServerConfig validates server configuration
func (v *IRValidator) ValidateServerConfig(url string, index int) {
	basePath := fmt.Sprintf("servers[%d]", index)

	if strings.TrimSpace(url) == "" {
		v.AddError("MISSING_SERVER_URL", "Server URL is required", basePath+".url", nil)
	} else if !isValidURL(url) {
		v.AddError("INVALID_SERVER_URL", 
			"Server URL format is invalid", 
			basePath+".url", 
			map[string]string{"url": url})
	}
}

// Helper functions

func isValidVersion(version string) bool {
	// Semantic versioning pattern
	semverPattern := `^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$`
	matched, _ := regexp.MatchString(semverPattern, version)
	return matched
}

func isValidHTTPMethod(method string) bool {
	validMethods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"}
	return contains(validMethods, strings.ToUpper(method))
}

func isValidPath(path string) bool {
	// Path should start with / or be empty for relative paths
	return strings.HasPrefix(path, "/") || path == ""
}

func isValidURL(url string) bool {
	// Basic URL validation
	return strings.HasPrefix(url, "http://") || 
		   strings.HasPrefix(url, "https://") || 
		   strings.HasPrefix(url, "ws://") || 
		   strings.HasPrefix(url, "wss://") ||
		   strings.HasPrefix(url, "grpc://") ||
		   strings.HasPrefix(url, "grpcs://")
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// ValidateTypeDefinition validates a type definition
func (v *IRValidator) ValidateTypeDefinition(name, typeName string, index int) {
	basePath := fmt.Sprintf("types[%d]", index)

	if strings.TrimSpace(name) == "" {
		v.AddWarning("MISSING_TYPE_NAME", "Type name is recommended", basePath+".name", nil)
	}

	if strings.TrimSpace(typeName) == "" {
		v.AddError("MISSING_TYPE", "Type is required", basePath+".type", nil)
	}

	validTypes := []string{"string", "number", "integer", "boolean", "array", "object", "null", "any"}
	if !contains(validTypes, typeName) {
		v.AddWarning("NON_STANDARD_TYPE", 
			"Type is not a standard JSON Schema type", 
			basePath+".type", 
			map[string]string{"type": typeName})
	}
}

// ValidateCircularReferences checks for circular references in type definitions
func (v *IRValidator) ValidateCircularReferences(types map[string]interface{}) {
	// TODO: Implement circular reference detection
	// This is a placeholder for future implementation
}

// ValidateRequiredFields validates that required fields are present
func (v *IRValidator) ValidateRequiredFields(fields map[string]interface{}, required []string, basePath string) {
	for _, field := range required {
		if _, ok := fields[field]; !ok {
			v.AddError("MISSING_REQUIRED_FIELD", 
				fmt.Sprintf("Required field '%s' is missing", field), 
				basePath, 
				map[string]string{"field": field})
		}
	}
}
