package parser

// Legacy types for format-specific parsers (OpenAPI, GraphQL, Postman)
// These types are used by the existing parsers and will be converted to IR by converters

// ParsedSpec represents a parsed OpenAPI specification (legacy format)
type ParsedSpec struct {
	Info       SpecInfo                 `json:"info"`
	Servers    []Server                 `json:"servers,omitempty"`
	Paths      map[string]Path          `json:"paths"`
	Components *Components              `json:"components,omitempty"`
	Security   []SecurityRequirement    `json:"security,omitempty"`
	Tags       []TagInfo                `json:"tags,omitempty"`
	Endpoints  []Endpoint               `json:"endpoints,omitempty"`
	Metadata   map[string]interface{}   `json:"metadata,omitempty"`
	Validation *ValidationResult        `json:"validation,omitempty"`
}

// SpecInfo represents OpenAPI specification info
type SpecInfo struct {
	Title          string        `json:"title"`
	Description    string        `json:"description,omitempty"`
	Version        string        `json:"version"`
	TermsOfService string        `json:"termsOfService,omitempty"`
	Contact        *ContactInfo  `json:"contact,omitempty"`
	License        *LicenseInfo  `json:"license,omitempty"`
}

// Server represents an API server
type Server struct {
	URL         string            `json:"url"`
	Description string            `json:"description,omitempty"`
	Variables   map[string]string `json:"variables,omitempty"`
}

// Path represents an API path
type Path struct {
	Summary     string                `json:"summary,omitempty"`
	Description string                `json:"description,omitempty"`
	Operations  map[string]*Operation `json:"operations,omitempty"`
}

// Operation represents an API operation
type Operation struct {
	ID          string                     `json:"operationId,omitempty"`
	Method      string                     `json:"method"`
	Path        string                     `json:"path,omitempty"`
	Summary     string                     `json:"summary,omitempty"`
	Description string                     `json:"description,omitempty"`
	Tags        []string                   `json:"tags,omitempty"`
	Deprecated  bool                       `json:"deprecated,omitempty"`
	Parameters  []Parameter                `json:"parameters,omitempty"`
	RequestBody *RequestBodyInfo           `json:"requestBody,omitempty"`
	Responses   map[string]*LegacyResponse `json:"responses,omitempty"`
	Security    []SecurityRequirement      `json:"security,omitempty"`
}

// RequestBodyInfo represents request body information
type RequestBodyInfo struct {
	Description string             `json:"description,omitempty"`
	Required    bool               `json:"required,omitempty"`
	Content     map[string]*Media  `json:"content,omitempty"`
}

// Media represents media type information
type Media struct {
	Schema  *Schema     `json:"schema,omitempty"`
	Example interface{} `json:"example,omitempty"`
}

// Schema represents a JSON schema
type Schema struct {
	Type                 string                     `json:"type,omitempty"`
	Format               string                     `json:"format,omitempty"`
	Title                string                     `json:"title,omitempty"`
	Description          string                     `json:"description,omitempty"`
	Nullable             bool                       `json:"nullable,omitempty"`
	ReadOnly             bool                       `json:"readOnly,omitempty"`
	WriteOnly            bool                       `json:"writeOnly,omitempty"`
	Required             []string                   `json:"required,omitempty"`
	Properties           map[string]*Schema         `json:"properties,omitempty"`
	Items                *Schema                    `json:"items,omitempty"`
	Enum                 []interface{}              `json:"enum,omitempty"`
	Default              interface{}                `json:"default,omitempty"`
	Example              interface{}                `json:"example,omitempty"`
	Ref                  string                     `json:"$ref,omitempty"`
	AllOf                []*Schema                  `json:"allOf,omitempty"`
	OneOf                []*Schema                  `json:"oneOf,omitempty"`
	AnyOf                []*Schema                  `json:"anyOf,omitempty"`
	AdditionalProperties interface{}                `json:"additionalProperties,omitempty"`
	Minimum              *float64                   `json:"minimum,omitempty"`
	Maximum              *float64                   `json:"maximum,omitempty"`
	MultipleOf           *float64                   `json:"multipleOf,omitempty"`
	MinLength            *uint64                    `json:"minLength,omitempty"`
	MaxLength            *uint64                    `json:"maxLength,omitempty"`
	Pattern              string                     `json:"pattern,omitempty"`
}

// Components represents OpenAPI components
type Components struct {
	Schemas         map[string]*Schema              `json:"schemas,omitempty"`
	Responses       map[string]*Response            `json:"responses,omitempty"`
	Parameters      map[string]*Parameter           `json:"parameters,omitempty"`
	RequestBodies   map[string]*RequestBodyInfo     `json:"requestBodies,omitempty"`
	Headers         map[string]*Header              `json:"headers,omitempty"`
	SecuritySchemes map[string]*SecurityScheme      `json:"securitySchemes,omitempty"`
}

// SecurityScheme represents a security scheme
type SecurityScheme struct {
	Type             string      `json:"type"`
	Description      string      `json:"description,omitempty"`
	Name             string      `json:"name,omitempty"`
	In               string      `json:"in,omitempty"`
	Scheme           string      `json:"scheme,omitempty"`
	BearerFormat     string      `json:"bearerFormat,omitempty"`
	Flows            *OAuthFlows `json:"flows,omitempty"`
	OpenIdConnectUrl string      `json:"openIdConnectUrl,omitempty"`
}

// SecurityRequirement represents a security requirement
type SecurityRequirement map[string][]string

// TagInfo represents tag information
type TagInfo struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// ValidationResult represents validation results (legacy format - alias for ValidationResults)
type ValidationResult = ValidationResults

// MediaType represents a media type
type MediaType struct {
	Schema  *Schema     `json:"schema,omitempty"`
	Example interface{} `json:"example,omitempty"`
}

// Example represents an example value
type Example struct {
	Summary       string      `json:"summary,omitempty"`
	Description   string      `json:"description,omitempty"`
	Value         interface{} `json:"value,omitempty"`
	ExternalValue string      `json:"externalValue,omitempty"`
}

// SpecMetadata represents specification metadata (flexible map for compatibility)
type SpecMetadata map[string]interface{}

// LegacyResponse represents an OpenAPI-style response with Content field
// This is used by GraphQL parser for legacy compatibility
type LegacyResponse struct {
	Description string            `json:"description,omitempty"`
	Content     map[string]*Media `json:"content,omitempty"`
}

// Ensure types are exported and match expectations
type (
	// Re-export types for clarity
	_ = Media
	_ = MediaType
)
