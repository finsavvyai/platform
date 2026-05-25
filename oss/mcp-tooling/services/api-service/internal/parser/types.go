package parser

import (
	"context"
	"time"
)

// UniversalParser defines the interface that all API specification parsers must implement
type UniversalParser interface {
	// Parse parses the input specification and returns an intermediate representation
	Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error)

	// DetectFormat attempts to detect the format of the input specification
	DetectFormat(input []byte) (string, error)

	// Validate validates the intermediate representation
	Validate(ir *IntermediateRepresentation) (*ValidationResults, error)

	// GetFormat returns the format this parser supports
	GetFormat() string

	// GetVersion returns the parser version
	GetVersion() string

	// GetSupportedVersions returns the specification versions this parser supports
	GetSupportedVersions() []string
}

// ParseOptions contains options for parsing
type ParseOptions struct {
	// StrictMode enables strict validation
	StrictMode bool
	// ResolveRefs resolves external references
	ResolveRefs bool
	// MaxDepth maximum depth for nested structures
	MaxDepth int
	// BaseURL for resolving relative references
	BaseURL string
	// AllowUnknownFields allows unknown fields in specifications
	AllowUnknownFields bool
	// Timeout for parsing operations
	Timeout time.Duration
	// CustomValidators for custom validation rules
	CustomValidators []Validator
	// Extensions for parser-specific options
	Extensions map[string]interface{}
}

// IntermediateRepresentation is the unified representation of all API specifications
type IntermediateRepresentation struct {
	Metadata   APIMetadata              `json:"metadata"`
	Endpoints  []UnifiedEndpoint        `json:"endpoints"`
	Types      []TypeDefinition         `json:"types"`
	Auth       []AuthScheme             `json:"auth"`
	Servers    []ServerConfig           `json:"servers"`
	Globals    GlobalConfig             `json:"globals"`
	Extensions map[string]interface{}   `json:"extensions,omitempty"`
	Source     SourceInfo               `json:"source"`
}

// APIMetadata contains metadata about the API
type APIMetadata struct {
	Name           string               `json:"name"`
	Description    string               `json:"description"`
	Version        string               `json:"version"`
	Title          string               `json:"title"`
	TermsOfService string               `json:"terms_of_service,omitempty"`
	Contact        *ContactInfo         `json:"contact,omitempty"`
	License        *LicenseInfo         `json:"license,omitempty"`
	Tags           []Tag                `json:"tags,omitempty"`
	Documentation  []DocumentationLink  `json:"documentation,omitempty"`
	CreatedAt      time.Time            `json:"created_at,omitempty"`
	UpdatedAt      time.Time            `json:"updated_at,omitempty"`
}

// DocumentationLink represents a link to documentation
type DocumentationLink struct {
	URL         string `json:"url"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type,omitempty"` // openapi, postman, redoc, etc.
}

// UnifiedEndpoint represents a single API endpoint/operation
type UnifiedEndpoint struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Method      string                 `json:"method"`
	Path        string                 `json:"path"`
	Parameters  []Parameter            `json:"parameters,omitempty"`
	RequestBody *RequestBody           `json:"request_body,omitempty"`
	Responses   []Response             `json:"responses,omitempty"`
	Auth        []string               `json:"auth,omitempty"`
	Tags        []string               `json:"tags,omitempty"`
	Deprecated  bool                   `json:"deprecated,omitempty"`
	RateLimit   *RateLimitInfo         `json:"rate_limit,omitempty"`
	Examples    []EndpointExample      `json:"examples,omitempty"`
	Streaming   *StreamingInfo         `json:"streaming,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// ContactInfo contains API contact information
type ContactInfo struct {
	Name  string `json:"name,omitempty"`
	URL   string `json:"url,omitempty"`
	Email string `json:"email,omitempty"`
}

// LicenseInfo contains API license information
type LicenseInfo struct {
	Name string `json:"name"`
	URL  string `json:"url,omitempty"`
}

// Tag represents an API tag
type Tag struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// Parameter represents an API parameter
type Parameter struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"` // query, header, path, cookie
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required,omitempty"`
	Deprecated  bool                   `json:"deprecated,omitempty"`
	Schema      *TypeReference         `json:"schema,omitempty"`
	Style       string                 `json:"style,omitempty"`
	Explode     bool                   `json:"explode,omitempty"`
	Example     interface{}            `json:"example,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// RequestBody represents a request body
type RequestBody struct {
	Description string         `json:"description,omitempty"`
	Required    bool           `json:"required,omitempty"`
	ContentType string         `json:"content_type"`
	Schema      *TypeReference `json:"schema,omitempty"`
}

// RequestBodySchema represents a request body schema (alias for compatibility)
type RequestBodySchema = RequestBody

// Response represents an API response
type Response struct {
	StatusCode  string                 `json:"status_code"`
	Description string                 `json:"description,omitempty"`
	ContentType string                 `json:"content_type,omitempty"`
	Schema      *TypeReference         `json:"schema,omitempty"`
	Headers     map[string]Header      `json:"headers,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// ResponseSchema represents a response schema (alias for compatibility)
type ResponseSchema = Response

// Header represents an HTTP header
type Header struct {
	Description string         `json:"description,omitempty"`
	Required    bool           `json:"required,omitempty"`
	Schema      *TypeReference `json:"schema,omitempty"`
}

// RateLimitInfo contains rate limiting information
type RateLimitInfo struct {
	RequestsPerSecond int                    `json:"requests_per_second,omitempty"`
	RequestsPerMinute int                    `json:"requests_per_minute,omitempty"`
	RequestsPerHour   int                    `json:"requests_per_hour,omitempty"`
	BurstSize         int                    `json:"burst_size,omitempty"`
	Extensions        map[string]interface{} `json:"extensions,omitempty"`
}

// EndpointExample contains an endpoint example
type EndpointExample struct {
	Name        string      `json:"name,omitempty"`
	Description string      `json:"description,omitempty"`
	Request     interface{} `json:"request,omitempty"`
	Response    interface{} `json:"response,omitempty"`
}

// StreamingInfo contains information about streaming endpoints
type StreamingInfo struct {
	Type     string                 `json:"type"` // server-stream, client-stream, bidirectional
	Settings map[string]interface{} `json:"settings,omitempty"`
}

// TypeDefinition represents a type/schema definition
type TypeDefinition struct {
	Name                 string                       `json:"name"`
	Type                 string                       `json:"type"` // object, array, string, number, integer, boolean
	Description          string                       `json:"description,omitempty"`
	Properties           map[string]PropertyDefinition `json:"properties,omitempty"`
	Required             []string                     `json:"required,omitempty"`
	AdditionalProperties interface{}                  `json:"additional_properties,omitempty"`
	Items                *TypeReference               `json:"items,omitempty"`
	Enum                 []interface{}                `json:"enum,omitempty"`
	Format               string                       `json:"format,omitempty"`
	Pattern              string                       `json:"pattern,omitempty"`
	MinLength            *int                         `json:"min_length,omitempty"`
	MaxLength            *int                         `json:"max_length,omitempty"`
	Minimum              *float64                     `json:"minimum,omitempty"`
	Maximum              *float64                     `json:"maximum,omitempty"`
	Extensions           map[string]interface{}       `json:"extensions,omitempty"`
}

// PropertyDefinition represents a property within a type
type PropertyDefinition struct {
	Type                 string                 `json:"type"`
	Description          string                 `json:"description,omitempty"`
	Format               string                 `json:"format,omitempty"`
	Ref                  string                 `json:"$ref,omitempty"`
	Items                *TypeReference         `json:"items,omitempty"`
	Enum                 []interface{}          `json:"enum,omitempty"`
	Default              interface{}            `json:"default,omitempty"`
	Example              interface{}            `json:"example,omitempty"`
	Nullable             bool                   `json:"nullable,omitempty"`
	ReadOnly             bool                   `json:"read_only,omitempty"`
	WriteOnly            bool                   `json:"write_only,omitempty"`
	Deprecated           bool                   `json:"deprecated,omitempty"`
	AdditionalProperties interface{}            `json:"additional_properties,omitempty"`
	Extensions           map[string]interface{} `json:"extensions,omitempty"`
}

// TypeReference represents a reference to a type
type TypeReference struct {
	Ref  string `json:"$ref,omitempty"`
	Type string `json:"type,omitempty"`
}

// AuthScheme represents an authentication scheme
type AuthScheme struct {
	Type        string                 `json:"type"` // apiKey, http, oauth2, openIdConnect, none
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	In          string                 `json:"in,omitempty"` // header, query, cookie
	Scheme      string                 `json:"scheme,omitempty"` // bearer, basic, digest
	BearerFormat string                `json:"bearer_format,omitempty"`
	Flows       *OAuthFlows            `json:"flows,omitempty"`
	OpenIDConnectURL string            `json:"openid_connect_url,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// OAuthFlows contains OAuth flow configurations
type OAuthFlows struct {
	Implicit          *OAuthFlow `json:"implicit,omitempty"`
	Password          *OAuthFlow `json:"password,omitempty"`
	ClientCredentials *OAuthFlow `json:"client_credentials,omitempty"`
	AuthorizationCode *OAuthFlow `json:"authorization_code,omitempty"`
}

// OAuthFlow represents an OAuth flow
type OAuthFlow struct {
	AuthorizationURL string            `json:"authorization_url,omitempty"`
	TokenURL         string            `json:"token_url,omitempty"`
	RefreshURL       string            `json:"refresh_url,omitempty"`
	Scopes           map[string]string `json:"scopes,omitempty"`
}

// ServerConfig represents a server configuration
type ServerConfig struct {
	URL         string                 `json:"url"`
	Description string                 `json:"description,omitempty"`
	Variables   map[string]ServerVariable `json:"variables,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// ServerVariable represents a server variable
type ServerVariable struct {
	Default     string   `json:"default"`
	Description string   `json:"description,omitempty"`
	Enum        []string `json:"enum,omitempty"`
}

// GlobalConfig contains global API configuration
type GlobalConfig struct {
	BaseURL     string                 `json:"base_url,omitempty"`
	Headers     map[string]string      `json:"headers,omitempty"`
	Timeout     int                    `json:"timeout,omitempty"` // in seconds
	RetryPolicy *RetryPolicy           `json:"retry_policy,omitempty"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
}

// RetryPolicy defines retry behavior
type RetryPolicy struct {
	MaxAttempts int   `json:"max_attempts,omitempty"`
	BackoffMs   int   `json:"backoff_ms,omitempty"`
	StatusCodes []int `json:"status_codes,omitempty"` // which status codes to retry
}

// SourceInfo contains information about the source specification
type SourceInfo struct {
	Format        string      `json:"format"` // openapi, graphql, grpc, postman, asyncapi, openhandler
	Version       string      `json:"version"`
	Location      string      `json:"location,omitempty"`
	ParserVersion string      `json:"parser_version"`
	ParsedAt      time.Time   `json:"parsed_at"`
	Raw           interface{} `json:"raw,omitempty"`
}

// ValidationResults contains validation results
type ValidationResults struct {
	Valid    bool              `json:"valid"`
	IsValid  bool              `json:"is_valid"` // Alias for Valid (for compatibility)
	Errors   []ValidationError `json:"errors,omitempty"`
	Warnings []ValidationError `json:"warnings,omitempty"`
	Info     []ValidationError `json:"info,omitempty"`
	Infos    []ValidationError `json:"infos,omitempty"` // Alias for Info (for compatibility)
}

// ValidationError represents a validation error
type ValidationError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Path    string                 `json:"path,omitempty"`
	Severity string                `json:"severity"` // error, warning, info
	Details map[string]interface{} `json:"details,omitempty"`
}

// Validator interface for custom validation
type Validator interface {
	Validate(ir *IntermediateRepresentation) []ValidationError
	Name() string
}

// FormatDetector interface for detecting API specification formats
type FormatDetector interface {
	Detect(input []byte) (format string, confidence float64, err error)
	GetName() string
}

// Endpoint is an alias for UnifiedEndpoint for compatibility
type Endpoint = UnifiedEndpoint
