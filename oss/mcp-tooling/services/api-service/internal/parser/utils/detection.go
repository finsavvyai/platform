package utils

import (
	"encoding/json"
	"strings"

	"gopkg.in/yaml.v3"
)

// DefaultFormatDetector implements format detection for common API specifications
type DefaultFormatDetector struct{}

// GetName returns the name of this detector
func (d *DefaultFormatDetector) GetName() string {
	return "DefaultFormatDetector"
}

// Detect attempts to detect the format of the input specification
func (d *DefaultFormatDetector) Detect(input []byte) (format string, confidence float64, err error) {
	// Trim whitespace
	trimmed := strings.TrimSpace(string(input))
	
	if len(trimmed) == 0 {
		return "", 0, nil
	}

	// Try to determine if it's JSON or YAML
	isJSON := false

	if trimmed[0] == '{' || trimmed[0] == '[' {
		isJSON = true
	}

	var data map[string]interface{}

	if isJSON {
		if err := json.Unmarshal(input, &data); err != nil {
			// Try YAML as fallback
			if err := yaml.Unmarshal(input, &data); err != nil {
				return "", 0, err
			}
		}
	} else {
		if err := yaml.Unmarshal(input, &data); err != nil {
			return "", 0, err
		}
	}

	// Detect OpenAPI
	if openAPIConfidence := d.detectOpenAPI(data); openAPIConfidence > 0 {
		return "openapi", openAPIConfidence, nil
	}

	// Detect AsyncAPI
	if asyncAPIConfidence := d.detectAsyncAPI(data); asyncAPIConfidence > 0 {
		return "asyncapi", asyncAPIConfidence, nil
	}

	// Detect Postman Collection
	if postmanConfidence := d.detectPostman(data); postmanConfidence > 0 {
		return "postman", postmanConfidence, nil
	}

	// Detect GraphQL
	if graphQLConfidence := d.detectGraphQL(data); graphQLConfidence > 0 {
		return "graphql", graphQLConfidence, nil
	}

	// Detect gRPC/Protocol Buffers
	if grpcConfidence := d.detectGRPC(input); grpcConfidence > 0 {
		return "grpc", grpcConfidence, nil
	}

	// Detect OpenHandler
	if openHandlerConfidence := d.detectOpenHandler(data); openHandlerConfidence > 0 {
		return "openhandler", openHandlerConfidence, nil
	}

	return "", 0, nil
}

// detectOpenAPI detects OpenAPI specifications
func (d *DefaultFormatDetector) detectOpenAPI(data map[string]interface{}) float64 {
	confidence := 0.0

	// Check for openapi field (OpenAPI 3.x)
	if openapi, ok := data["openapi"].(string); ok {
		if strings.HasPrefix(openapi, "3.") {
			confidence = 1.0
		}
	}

	// Check for swagger field (Swagger 2.0)
	if swagger, ok := data["swagger"].(string); ok {
		if swagger == "2.0" {
			confidence = 1.0
		}
	}

	// Check for common OpenAPI fields
	if _, hasInfo := data["info"]; hasInfo {
		if _, hasPaths := data["paths"]; hasPaths {
			confidence = 0.9
		}
	}

	return confidence
}

// detectAsyncAPI detects AsyncAPI specifications
func (d *DefaultFormatDetector) detectAsyncAPI(data map[string]interface{}) float64 {
	confidence := 0.0

	// Check for asyncapi field
	if asyncapi, ok := data["asyncapi"].(string); ok {
		if strings.HasPrefix(asyncapi, "2.") || strings.HasPrefix(asyncapi, "3.") {
			confidence = 1.0
		}
	}

	// Check for channels field (AsyncAPI 2.x)
	if _, hasChannels := data["channels"]; hasChannels {
		if _, hasInfo := data["info"]; hasInfo {
			confidence = 0.9
		}
	}

	return confidence
}

// detectPostman detects Postman collections
func (d *DefaultFormatDetector) detectPostman(data map[string]interface{}) float64 {
	confidence := 0.0

	// Check for info.schema field
	if info, ok := data["info"].(map[string]interface{}); ok {
		if schema, ok := info["schema"].(string); ok {
			if strings.Contains(schema, "postman") {
				confidence = 1.0
			}
		}
	}

	// Check for item field (collection items)
	if _, hasItem := data["item"]; hasItem {
		if info, hasInfo := data["info"].(map[string]interface{}); hasInfo {
			if _, hasName := info["name"]; hasName {
				confidence = 0.8
			}
		}
	}

	return confidence
}

// detectGraphQL detects GraphQL schemas
func (d *DefaultFormatDetector) detectGraphQL(data map[string]interface{}) float64 {
	confidence := 0.0

	// Check for __schema field (introspection response)
	if dataField, ok := data["data"].(map[string]interface{}); ok {
		if _, hasSchema := dataField["__schema"]; hasSchema {
			confidence = 1.0
		}
	}

	// Check for GraphQL SDL keywords
	if _, hasQuery := data["query"]; hasQuery {
		confidence = 0.7
	}

	if _, hasTypes := data["types"]; hasTypes {
		confidence = 0.6
	}

	return confidence
}

// detectGRPC detects Protocol Buffer definitions
func (d *DefaultFormatDetector) detectGRPC(input []byte) float64 {
	content := string(input)
	confidence := 0.0

	// Check for proto syntax
	if strings.Contains(content, "syntax = \"proto3\"") || strings.Contains(content, "syntax = \"proto2\"") {
		confidence = 1.0
	}

	// Check for common proto keywords
	protoKeywords := []string{"message ", "service ", "rpc ", "package "}
	matchCount := 0
	for _, keyword := range protoKeywords {
		if strings.Contains(content, keyword) {
			matchCount++
		}
	}

	if matchCount >= 2 {
		confidence = 0.8
	}

	return confidence
}

// detectOpenHandler detects OpenHandler specifications
func (d *DefaultFormatDetector) detectOpenHandler(data map[string]interface{}) float64 {
	confidence := 0.0

	// Check for openhandler field
	if openhandler, ok := data["openhandler"].(string); ok {
		if len(openhandler) > 0 {
			confidence = 1.0
		}
	}

	// Check for handlers field
	if _, hasHandlers := data["handlers"]; hasHandlers {
		if _, hasInfo := data["info"]; hasInfo {
			confidence = 0.8
		}
	}

	return confidence
}

// IsJSON checks if content is valid JSON
func IsJSON(content []byte) bool {
	var js map[string]interface{}
	return json.Unmarshal(content, &js) == nil
}

// IsYAML checks if content is valid YAML
func IsYAML(content []byte) bool {
	var data map[string]interface{}
	return yaml.Unmarshal(content, &data) == nil
}

// NormalizeFormat normalizes format names
func NormalizeFormat(format string) string {
	return strings.ToLower(strings.TrimSpace(format))
}

// GetContentType attempts to determine content type
func GetContentType(content []byte) string {
	if IsJSON(content) {
		return "application/json"
	}
	if IsYAML(content) {
		return "application/yaml"
	}
	return "text/plain"
}
