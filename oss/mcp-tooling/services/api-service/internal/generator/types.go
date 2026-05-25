package generator

import (
	"context"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// CodeGenerator defines the interface that all code generators must implement
type CodeGenerator interface {
	// Generate generates code from the intermediate representation
	Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error)

	// GetLanguage returns the target programming language
	GetLanguage() string

	// GetRuntime returns the target runtime environment
	GetRuntime() string

	// GetVersion returns the generator version
	GetVersion() string

	// Validate validates the generator can handle the given IR
	Validate(ir *parser.IntermediateRepresentation) (*ValidationResult, error)

	// GetSupportedFeatures returns features this generator supports
	GetSupportedFeatures() []Feature
}

// GenerateOptions contains options for code generation
type GenerateOptions struct {
	// Language target language (typescript, python, rust, go)
	Language string

	// Runtime target runtime (cloudflare-worker, deno, node, lambda, etc.)
	Runtime string

	// OutputFormat output format (single-file, multi-file, archive)
	OutputFormat string

	// PackageName name of the generated package/module
	PackageName string

	// IncludeTests whether to generate test files
	IncludeTests bool

	// IncludeDocs whether to generate documentation
	IncludeDocs bool

	// IncludeExamples whether to include example usage
	IncludeExamples bool

	// CustomTemplates custom template overrides
	CustomTemplates map[string]string

	// TemplateData additional data for templates
	TemplateData map[string]interface{}

	// AuthMode authentication mode (api_key, oauth, jwt, none)
	AuthMode string

	// Features specific features to enable/disable
	Features map[Feature]bool

	// Extensions generator-specific extensions
	Extensions map[string]interface{}

	// Timeout for generation operations
	Timeout time.Duration

	// StrictMode enables strict type checking and validation
	StrictMode bool

	// OptimizationLevel code optimization level (0-3)
	OptimizationLevel int
}

// GeneratedCode represents the output of code generation
type GeneratedCode struct {
	// Language the generated code language
	Language string `json:"language"`

	// Runtime the target runtime environment
	Runtime string `json:"runtime"`

	// Files generated files
	Files []GeneratedFile `json:"files"`

	// Metadata generation metadata
	Metadata GenerationMetadata `json:"metadata"`

	// Dependencies required dependencies
	Dependencies []Dependency `json:"dependencies"`

	// Configuration runtime configuration
	Configuration map[string]interface{} `json:"configuration,omitempty"`

	// DeploymentInstructions instructions for deployment
	DeploymentInstructions string `json:"deployment_instructions,omitempty"`

	// Extensions generator-specific extensions
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// GeneratedFile represents a single generated file
type GeneratedFile struct {
	// Path relative path of the file
	Path string `json:"path"`

	// Content file content
	Content string `json:"content"`

	// Type file type (source, test, config, docs)
	Type FileType `json:"type"`

	// Language programming language (may differ from main if multi-language)
	Language string `json:"language,omitempty"`

	// Metadata file-specific metadata
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// FileType represents the type of generated file
type FileType string

const (
	FileTypeSource FileType = "source"
	FileTypeTest   FileType = "test"
	FileTypeConfig FileType = "config"
	FileTypeDocs   FileType = "docs"
	FileTypeSchema FileType = "schema"
	FileTypeAsset  FileType = "asset"
)

// GenerationMetadata contains metadata about the generation process
type GenerationMetadata struct {
	// GeneratorName name of the generator
	GeneratorName string `json:"generator_name"`

	// GeneratorVersion version of the generator
	GeneratorVersion string `json:"generator_version"`

	// GeneratedAt timestamp of generation
	GeneratedAt time.Time `json:"generated_at"`

	// SourceFormat original API format
	SourceFormat string `json:"source_format"`

	// SourceVersion original API version
	SourceVersion string `json:"source_version"`

	// Features features included in generation
	Features []Feature `json:"features"`

	// Statistics generation statistics
	Statistics GenerationStatistics `json:"statistics"`

	// Extensions metadata extensions
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// GenerationStatistics contains statistics about generated code
type GenerationStatistics struct {
	// TotalFiles number of files generated
	TotalFiles int `json:"total_files"`

	// TotalLines total lines of code
	TotalLines int `json:"total_lines"`

	// TotalEndpoints number of endpoints generated
	TotalEndpoints int `json:"total_endpoints"`

	// TotalTypes number of types generated
	TotalTypes int `json:"total_types"`

	// GenerationTime time taken to generate
	GenerationTime time.Duration `json:"generation_time"`

	// Extensions statistics extensions
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// Dependency represents a code dependency
type Dependency struct {
	// Name dependency name
	Name string `json:"name"`

	// Version dependency version or constraint
	Version string `json:"version"`

	// Type dependency type (runtime, dev, peer)
	Type DependencyType `json:"type"`

	// Source package source (npm, pypi, crates.io, etc.)
	Source string `json:"source,omitempty"`

	// Required whether dependency is required
	Required bool `json:"required"`

	// Description dependency description
	Description string `json:"description,omitempty"`
}

// DependencyType represents the type of dependency
type DependencyType string

const (
	DependencyTypeRuntime DependencyType = "runtime"
	DependencyTypeDev     DependencyType = "dev"
	DependencyTypePeer    DependencyType = "peer"
	DependencyTypeOptional DependencyType = "optional"
)

// Feature represents a generator feature
type Feature string

const (
	// Core features
	FeatureBasicGeneration   Feature = "basic-generation"
	FeatureTypeGeneration    Feature = "type-generation"
	FeatureAuthGeneration    Feature = "auth-generation"
	FeatureValidation        Feature = "validation"
	FeatureErrorHandling     Feature = "error-handling"

	// Advanced features
	FeatureStreaming         Feature = "streaming"
	FeatureWebSockets        Feature = "websockets"
	FeatureRateLimiting      Feature = "rate-limiting"
	FeatureRetryLogic        Feature = "retry-logic"
	FeatureCaching           Feature = "caching"
	FeatureLogging           Feature = "logging"
	FeatureMetrics           Feature = "metrics"
	FeatureTracing           Feature = "tracing"

	// Testing features
	FeatureUnitTests         Feature = "unit-tests"
	FeatureIntegrationTests  Feature = "integration-tests"
	FeatureMockGeneration    Feature = "mock-generation"

	// Documentation features
	FeatureInlineDocs        Feature = "inline-docs"
	FeatureAPIReference      Feature = "api-reference"
	FeatureExamples          Feature = "examples"

	// Runtime features
	FeatureCloudflareWorker  Feature = "cloudflare-worker"
	FeatureDenoRuntime       Feature = "deno-runtime"
	FeatureNodeRuntime       Feature = "node-runtime"
	FeatureAWSLambda         Feature = "aws-lambda"
	FeatureGoogleCloudFunc   Feature = "google-cloud-function"
	FeatureWASM              Feature = "wasm"
	FeatureAsyncAwait        Feature = "async-await"

	// Protocol features
	FeatureRESTSupport       Feature = "rest-support"
	FeatureGraphQLSupport    Feature = "graphql-support"
	FeatureGRPCSupport       Feature = "grpc-support"
	FeatureWebhookSupport    Feature = "webhook-support"
	FeatureEventDriven       Feature = "event-driven"
)

// ValidationResult contains validation results for generation
type ValidationResult struct {
	// Valid whether the IR is valid for generation
	Valid bool `json:"valid"`

	// Errors validation errors
	Errors []ValidationError `json:"errors,omitempty"`

	// Warnings validation warnings
	Warnings []ValidationError `json:"warnings,omitempty"`

	// SupportedFeatures features that are supported
	SupportedFeatures []Feature `json:"supported_features"`

	// UnsupportedFeatures features that are not supported
	UnsupportedFeatures []Feature `json:"unsupported_features"`
}

// ValidationError represents a validation error
type ValidationError struct {
	// Code error code
	Code string `json:"code"`

	// Message error message
	Message string `json:"message"`

	// Path path to the error location
	Path string `json:"path,omitempty"`

	// Severity error severity
	Severity string `json:"severity"` // error, warning, info

	// Details additional details
	Details map[string]interface{} `json:"details,omitempty"`
}

// Template represents a code generation template
type Template struct {
	// Name template name
	Name string

	// Content template content
	Content string

	// Language target language
	Language string

	// Type template type (main, helper, partial)
	Type TemplateType

	// Description template description
	Description string

	// Variables template variables
	Variables []TemplateVariable

	// Metadata template metadata
	Metadata map[string]interface{}
}

// TemplateType represents the type of template
type TemplateType string

const (
	TemplateTypeMain    TemplateType = "main"
	TemplateTypeHelper  TemplateType = "helper"
	TemplateTypePartial TemplateType = "partial"
	TemplateTypeLayout  TemplateType = "layout"
)

// TemplateVariable represents a template variable
type TemplateVariable struct {
	// Name variable name
	Name string

	// Type variable type
	Type string

	// Required whether variable is required
	Required bool

	// Default default value
	Default interface{}

	// Description variable description
	Description string
}

// GeneratorInfo contains information about a registered generator
type GeneratorInfo struct {
	// Language target language
	Language string

	// Runtime target runtime
	Runtime string

	// Version generator version
	Version string

	// Features supported features
	Features []Feature

	// Description generator description
	Description string

	// Author generator author
	Author string

	// Repository source repository
	Repository string

	// License license information
	License string
}
