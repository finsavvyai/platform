package generator

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// BaseGenerator provides common functionality for all generators
type BaseGenerator struct {
	language string
	runtime  string
	version  string
	features []Feature
	engine   *TemplateEngine
}

// NewBaseGenerator creates a new base generator
func NewBaseGenerator(language, runtime, version string, features []Feature) *BaseGenerator {
	return &BaseGenerator{
		language: language,
		runtime:  runtime,
		version:  version,
		features: features,
		engine:   NewTemplateEngine(),
	}
}

// GetLanguage returns the target language
func (g *BaseGenerator) GetLanguage() string {
	return g.language
}

// GetRuntime returns the target runtime
func (g *BaseGenerator) GetRuntime() string {
	return g.runtime
}

// GetVersion returns the generator version
func (g *BaseGenerator) GetVersion() string {
	return g.version
}

// GetSupportedFeatures returns supported features
func (g *BaseGenerator) GetSupportedFeatures() []Feature {
	return g.features
}

// HasFeature checks if a feature is supported
func (g *BaseGenerator) HasFeature(feature Feature) bool {
	for _, f := range g.features {
		if f == feature {
			return true
		}
	}
	return false
}

// GetTemplateEngine returns the template engine
func (g *BaseGenerator) GetTemplateEngine() *TemplateEngine {
	return g.engine
}

// Validate validates the IR for generation
func (g *BaseGenerator) Validate(ir *parser.IntermediateRepresentation) (*ValidationResult, error) {
	result := &ValidationResult{
		Valid:               true,
		Errors:              []ValidationError{},
		Warnings:            []ValidationError{},
		SupportedFeatures:   g.features,
		UnsupportedFeatures: []Feature{},
	}

	// Basic validation
	if ir == nil {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Code:     "nil_ir",
			Message:  "Intermediate representation is nil",
			Severity: "error",
		})
		return result, nil
	}

	// Validate metadata
	if ir.Metadata.Name == "" {
		result.Warnings = append(result.Warnings, ValidationError{
			Code:     "missing_name",
			Message:  "API name is missing",
			Severity: "warning",
		})
	}

	if ir.Metadata.Version == "" {
		result.Warnings = append(result.Warnings, ValidationError{
			Code:     "missing_version",
			Message:  "API version is missing",
			Severity: "warning",
		})
	}

	// Validate endpoints
	if len(ir.Endpoints) == 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Code:     "no_endpoints",
			Message:  "No endpoints found in specification",
			Severity: "error",
		})
	}

	for i, endpoint := range ir.Endpoints {
		if endpoint.Method == "" {
			result.Errors = append(result.Errors, ValidationError{
				Code:     "missing_method",
				Message:  fmt.Sprintf("Endpoint %d is missing HTTP method", i),
				Path:     endpoint.Path,
				Severity: "error",
			})
			result.Valid = false
		}

		if endpoint.Path == "" {
			result.Errors = append(result.Errors, ValidationError{
				Code:     "missing_path",
				Message:  fmt.Sprintf("Endpoint %d is missing path", i),
				Severity: "error",
			})
			result.Valid = false
		}
	}

	// Check for streaming support
	for _, endpoint := range ir.Endpoints {
		if endpoint.Streaming != nil && !g.HasFeature(FeatureStreaming) {
			result.UnsupportedFeatures = append(result.UnsupportedFeatures, FeatureStreaming)
			result.Warnings = append(result.Warnings, ValidationError{
				Code:     "unsupported_streaming",
				Message:  "Streaming endpoints detected but not supported by this generator",
				Path:     endpoint.Path,
				Severity: "warning",
			})
		}
	}

	// Check for WebSocket support
	for _, endpoint := range ir.Endpoints {
		if endpoint.Extensions != nil {
			if protocol, ok := endpoint.Extensions["protocol"].(string); ok && protocol == "websocket" {
				if !g.HasFeature(FeatureWebSockets) {
					result.UnsupportedFeatures = append(result.UnsupportedFeatures, FeatureWebSockets)
					result.Warnings = append(result.Warnings, ValidationError{
						Code:     "unsupported_websocket",
						Message:  "WebSocket endpoints detected but not supported by this generator",
						Path:     endpoint.Path,
						Severity: "warning",
					})
				}
			}
		}
	}

	return result, nil
}

// CreateGeneratedCode creates a GeneratedCode structure
func (g *BaseGenerator) CreateGeneratedCode(files []GeneratedFile, deps []Dependency, stats GenerationStatistics) *GeneratedCode {
	return &GeneratedCode{
		Language: g.language,
		Runtime:  g.runtime,
		Files:    files,
		Metadata: GenerationMetadata{
			GeneratorName:    fmt.Sprintf("%s-%s", g.language, g.runtime),
			GeneratorVersion: g.version,
			GeneratedAt:      time.Now(),
			Features:         g.features,
			Statistics:       stats,
		},
		Dependencies:  deps,
		Configuration: make(map[string]interface{}),
		Extensions:    make(map[string]interface{}),
	}
}

// CountLines counts the number of lines in generated code
func (g *BaseGenerator) CountLines(files []GeneratedFile) int {
	total := 0
	for _, file := range files {
		total += len(splitLines(file.Content))
	}
	return total
}

// splitLines splits text into lines
func splitLines(text string) []string {
	if text == "" {
		return []string{}
	}
	lines := []string{}
	current := ""
	for _, r := range text {
		if r == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(r)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}

// Generate is a placeholder that should be overridden by specific generators
func (g *BaseGenerator) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	return nil, fmt.Errorf("Generate method must be implemented by specific generator")
}

// Helper functions for common operations

// ExtractEndpointsByTag groups endpoints by tags
func ExtractEndpointsByTag(ir *parser.IntermediateRepresentation) map[string][]parser.UnifiedEndpoint {
	byTag := make(map[string][]parser.UnifiedEndpoint)

	for _, endpoint := range ir.Endpoints {
		if len(endpoint.Tags) == 0 {
			byTag["default"] = append(byTag["default"], endpoint)
		} else {
			for _, tag := range endpoint.Tags {
				byTag[tag] = append(byTag[tag], endpoint)
			}
		}
	}

	return byTag
}

// ExtractAuthSchemesByType groups auth schemes by type
func ExtractAuthSchemesByType(ir *parser.IntermediateRepresentation) map[string][]parser.AuthScheme {
	byType := make(map[string][]parser.AuthScheme)

	for _, auth := range ir.Auth {
		byType[auth.Type] = append(byType[auth.Type], auth)
	}

	return byType
}

// GetPrimaryServer returns the first server or a default
func GetPrimaryServer(ir *parser.IntermediateRepresentation) string {
	if len(ir.Servers) > 0 {
		return ir.Servers[0].URL
	}
	return "https://api.example.com"
}

// NeedsAuthentication checks if any endpoints require authentication
func NeedsAuthentication(ir *parser.IntermediateRepresentation) bool {
	if len(ir.Auth) > 0 {
		return true
	}

	for _, endpoint := range ir.Endpoints {
		if len(endpoint.Auth) > 0 {
			return true
		}
	}

	return false
}

// HasStreamingEndpoints checks if any endpoints use streaming
func HasStreamingEndpoints(ir *parser.IntermediateRepresentation) bool {
	for _, endpoint := range ir.Endpoints {
		if endpoint.Streaming != nil {
			return true
		}
	}
	return false
}

// escapeString escapes special characters in strings for code generation
func escapeString(s string) string {
	s = strings.ReplaceAll(s, "'", "\\'")
	s = strings.ReplaceAll(s, "\n", "\\n")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	return s
}

// sanitizeIdentifier sanitizes a string to be a valid identifier
func sanitizeIdentifier(s string) string {
	// Replace non-alphanumeric characters with underscore
	result := ""
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' {
			result += string(r)
		} else {
			result += "_"
		}
	}
	return result
}

// contains checks if a slice contains a specific item
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
