package parser

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser/utils"
)

// OpenHandlerParser implements the UniversalParser interface for OpenHandler specifications
type OpenHandlerParser struct {
	version string
}

// NewOpenHandlerParser creates a new OpenHandler parser
func NewOpenHandlerParser() *OpenHandlerParser {
	return &OpenHandlerParser{
		version: "1.0.0",
	}
}

// OpenHandlerDocument represents an OpenHandler specification document
type OpenHandlerDocument struct {
	OpenHandler string                        `json:"openhandler"`
	Info        OpenHandlerInfo               `json:"info"`
	Servers     []OpenHandlerServer           `json:"servers,omitempty"`
	Handlers    map[string]OpenHandlerHandler `json:"handlers"`
	Components  *OpenHandlerComponents        `json:"components,omitempty"`
	Security    []map[string][]string         `json:"security,omitempty"`
	Tags        []Tag                         `json:"tags,omitempty"`
}

// OpenHandlerInfo contains API metadata
type OpenHandlerInfo struct {
	Title          string       `json:"title"`
	Version        string       `json:"version"`
	Description    string       `json:"description,omitempty"`
	TermsOfService string       `json:"termsOfService,omitempty"`
	Contact        *ContactInfo `json:"contact,omitempty"`
	License        *LicenseInfo `json:"license,omitempty"`
}

// OpenHandlerServer represents a server configuration
type OpenHandlerServer struct {
	URL         string                    `json:"url"`
	Description string                    `json:"description,omitempty"`
	Variables   map[string]ServerVariable `json:"variables,omitempty"`
}

// OpenHandlerHandler represents a single handler (endpoint)
type OpenHandlerHandler struct {
	Summary     string                        `json:"summary,omitempty"`
	Description string                        `json:"description,omitempty"`
	Method      string                        `json:"method"` // GET, POST, PUT, DELETE, etc.
	Path        string                        `json:"path"`
	Parameters  []OpenHandlerParameter        `json:"parameters,omitempty"`
	RequestBody *OpenHandlerRequestBody       `json:"requestBody,omitempty"`
	Responses   map[string]OpenHandlerResponse `json:"responses,omitempty"`
	Security    []map[string][]string         `json:"security,omitempty"`
	Tags        []string                      `json:"tags,omitempty"`
	Deprecated  bool                          `json:"deprecated,omitempty"`
	Middleware  []string                      `json:"middleware,omitempty"`
	Timeout     int                           `json:"timeout,omitempty"` // in seconds
}

// OpenHandlerParameter represents a handler parameter
type OpenHandlerParameter struct {
	Name        string                 `json:"name"`
	In          string                 `json:"in"` // query, header, path, cookie
	Description string                 `json:"description,omitempty"`
	Required    bool                   `json:"required,omitempty"`
	Deprecated  bool                   `json:"deprecated,omitempty"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
	Example     interface{}            `json:"example,omitempty"`
}

// OpenHandlerRequestBody represents a request body
type OpenHandlerRequestBody struct {
	Description string                            `json:"description,omitempty"`
	Required    bool                              `json:"required,omitempty"`
	Content     map[string]OpenHandlerMediaType   `json:"content"`
}

// OpenHandlerMediaType represents a media type
type OpenHandlerMediaType struct {
	Schema   map[string]interface{} `json:"schema,omitempty"`
	Example  interface{}            `json:"example,omitempty"`
	Examples map[string]interface{} `json:"examples,omitempty"`
}

// OpenHandlerResponse represents a response
type OpenHandlerResponse struct {
	Description string                          `json:"description"`
	Content     map[string]OpenHandlerMediaType `json:"content,omitempty"`
	Headers     map[string]interface{}          `json:"headers,omitempty"`
}

// OpenHandlerComponents holds reusable objects
type OpenHandlerComponents struct {
	Schemas         map[string]interface{}        `json:"schemas,omitempty"`
	Responses       map[string]OpenHandlerResponse `json:"responses,omitempty"`
	Parameters      map[string]OpenHandlerParameter `json:"parameters,omitempty"`
	RequestBodies   map[string]OpenHandlerRequestBody `json:"requestBodies,omitempty"`
	Headers         map[string]interface{}        `json:"headers,omitempty"`
	SecuritySchemes map[string]interface{}        `json:"securitySchemes,omitempty"`
}

// Parse implements the UniversalParser interface
func (p *OpenHandlerParser) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	var doc OpenHandlerDocument
	if err := json.Unmarshal(input, &doc); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OpenHandler document: %w", err)
	}

	// Validate required fields
	if doc.OpenHandler == "" {
		return nil, fmt.Errorf("missing required field: openhandler")
	}
	if doc.Info.Title == "" {
		return nil, fmt.Errorf("missing required field: info.title")
	}
	if doc.Info.Version == "" {
		return nil, fmt.Errorf("missing required field: info.version")
	}

	// Convert to intermediate representation
	ir := &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:           doc.Info.Title,
			Title:          doc.Info.Title,
			Description:    doc.Info.Description,
			Version:        doc.Info.Version,
			TermsOfService: doc.Info.TermsOfService,
			Contact:        doc.Info.Contact,
			License:        doc.Info.License,
			Tags:           doc.Tags,
		},
		Endpoints: p.convertHandlers(doc),
		Types:     p.extractTypes(doc),
		Auth:      p.extractAuthSchemes(doc),
		Servers:   p.convertServers(doc.Servers),
		Globals: GlobalConfig{
			Headers: make(map[string]string),
		},
		Extensions: map[string]interface{}{
			"openhandler_version": doc.OpenHandler,
		},
		Source: SourceInfo{
			Format:        "openhandler",
			Version:       doc.OpenHandler,
			ParserVersion: p.version,
			ParsedAt:      time.Now(),
			Raw:           doc,
		},
	}

	return ir, nil
}

// convertHandlers converts OpenHandler handlers to unified endpoints
func (p *OpenHandlerParser) convertHandlers(doc OpenHandlerDocument) []UnifiedEndpoint {
	var endpoints []UnifiedEndpoint

	for handlerID, handler := range doc.Handlers {
		endpoint := UnifiedEndpoint{
			ID:          handlerID,
			Name:        handler.Summary,
			Description: handler.Description,
			Method:      strings.ToUpper(handler.Method),
			Path:        handler.Path,
			Parameters:  p.convertParameters(handler.Parameters),
			Tags:        handler.Tags,
			Deprecated:  handler.Deprecated,
			Extensions: map[string]interface{}{
				"handler_id": handlerID,
				"middleware": handler.Middleware,
				"timeout":    handler.Timeout,
			},
		}

		// Convert request body
		if handler.RequestBody != nil {
			endpoint.RequestBody = p.convertRequestBody(handler.RequestBody)
		}

		// Convert responses
		endpoint.Responses = p.convertResponses(handler.Responses)

		// Extract auth requirements
		if len(handler.Security) > 0 {
			endpoint.Auth = p.extractSecurityRequirements(handler.Security)
		}

		endpoints = append(endpoints, endpoint)
	}

	return endpoints
}

// convertParameters converts OpenHandler parameters to IR parameters
func (p *OpenHandlerParser) convertParameters(params []OpenHandlerParameter) []Parameter {
	var result []Parameter

	for _, param := range params {
		irParam := Parameter{
			Name:        param.Name,
			In:          param.In,
			Description: param.Description,
			Required:    param.Required,
			Deprecated:  param.Deprecated,
			Example:     param.Example,
			Extensions:  map[string]interface{}{},
		}

		// Convert schema
		if param.Schema != nil {
			irParam.Schema = p.convertSchemaToTypeReference(param.Schema)
		}

		result = append(result, irParam)
	}

	return result
}

// convertRequestBody converts OpenHandler request body to IR request body
func (p *OpenHandlerParser) convertRequestBody(rb *OpenHandlerRequestBody) *RequestBody {
	if rb == nil {
		return nil
	}

	// Get first content type (usually application/json)
	var contentType string
	var schema *TypeReference

	for ct, mediaType := range rb.Content {
		contentType = ct
		if mediaType.Schema != nil {
			schema = p.convertSchemaToTypeReference(mediaType.Schema)
		}
		break // Use first content type
	}

	return &RequestBody{
		Description: rb.Description,
		Required:    rb.Required,
		ContentType: contentType,
		Schema:      schema,
	}
}

// convertResponses converts OpenHandler responses to IR responses
func (p *OpenHandlerParser) convertResponses(responses map[string]OpenHandlerResponse) []Response {
	var result []Response

	for statusCode, response := range responses {
		irResponse := Response{
			StatusCode:  statusCode,
			Description: response.Description,
			Headers:     make(map[string]Header),
			Extensions:  map[string]interface{}{},
		}

		// Convert content
		for contentType, mediaType := range response.Content {
			irResponse.ContentType = contentType
			if mediaType.Schema != nil {
				irResponse.Schema = p.convertSchemaToTypeReference(mediaType.Schema)
			}
			break // Use first content type
		}

		// Convert headers
		for headerName, headerSchema := range response.Headers {
			if headerMap, ok := headerSchema.(map[string]interface{}); ok {
				header := Header{
					Description: p.getStringField(headerMap, "description"),
					Required:    p.getBoolField(headerMap, "required"),
				}
				if schema, ok := headerMap["schema"].(map[string]interface{}); ok {
					header.Schema = p.convertSchemaToTypeReference(schema)
				}
				irResponse.Headers[headerName] = header
			}
		}

		result = append(result, irResponse)
	}

	return result
}

// convertSchemaToTypeReference converts a schema map to a TypeReference
func (p *OpenHandlerParser) convertSchemaToTypeReference(schema map[string]interface{}) *TypeReference {
	if schema == nil {
		return nil
	}

	typeRef := &TypeReference{}

	// Check for $ref
	if ref, ok := schema["$ref"].(string); ok {
		typeRef.Ref = ref
		return typeRef
	}

	// Get type
	if typeStr, ok := schema["type"].(string); ok {
		typeRef.Type = typeStr
	}

	return typeRef
}

// convertServers converts OpenHandler servers to IR servers
func (p *OpenHandlerParser) convertServers(servers []OpenHandlerServer) []ServerConfig {
	var result []ServerConfig

	for _, server := range servers {
		result = append(result, ServerConfig{
			URL:         server.URL,
			Description: server.Description,
			Variables:   server.Variables,
			Extensions:  map[string]interface{}{},
		})
	}

	return result
}

// extractTypes extracts type definitions from components
func (p *OpenHandlerParser) extractTypes(doc OpenHandlerDocument) []TypeDefinition {
	var types []TypeDefinition

	if doc.Components != nil && doc.Components.Schemas != nil {
		for name, schema := range doc.Components.Schemas {
			if schemaMap, ok := schema.(map[string]interface{}); ok {
				typeDef := TypeDefinition{
					Name:        name,
					Type:        p.getStringField(schemaMap, "type"),
					Description: p.getStringField(schemaMap, "description"),
					Extensions: map[string]interface{}{
						"schema": schema,
					},
				}

				// Extract properties
				if props, ok := schemaMap["properties"].(map[string]interface{}); ok {
					typeDef.Properties = p.convertProperties(props)
				}

				// Extract required fields
				if required, ok := schemaMap["required"].([]interface{}); ok {
					typeDef.Required = p.convertToStringSlice(required)
				}

				types = append(types, typeDef)
			}
		}
	}

	return types
}

// convertProperties converts schema properties to PropertyDefinitions
func (p *OpenHandlerParser) convertProperties(props map[string]interface{}) map[string]PropertyDefinition {
	result := make(map[string]PropertyDefinition)

	for propName, propSchema := range props {
		if propMap, ok := propSchema.(map[string]interface{}); ok {
			prop := PropertyDefinition{
				Type:        p.getStringField(propMap, "type"),
				Description: p.getStringField(propMap, "description"),
				Format:      p.getStringField(propMap, "format"),
				Extensions:  map[string]interface{}{},
			}

			// Extract enum
			if enum, ok := propMap["enum"].([]interface{}); ok {
				prop.Enum = enum
			}

			result[propName] = prop
		}
	}

	return result
}

// extractAuthSchemes extracts authentication schemes
func (p *OpenHandlerParser) extractAuthSchemes(doc OpenHandlerDocument) []AuthScheme {
	var schemes []AuthScheme

	if doc.Components != nil && doc.Components.SecuritySchemes != nil {
		for name, schemeData := range doc.Components.SecuritySchemes {
			if schemeMap, ok := schemeData.(map[string]interface{}); ok {
				scheme := AuthScheme{
					Type:        p.getStringField(schemeMap, "type"),
					Name:        name,
					Description: p.getStringField(schemeMap, "description"),
					In:          p.getStringField(schemeMap, "in"),
					Scheme:      p.getStringField(schemeMap, "scheme"),
					Extensions:  map[string]interface{}{},
				}

				schemes = append(schemes, scheme)
			}
		}
	}

	return schemes
}

// extractSecurityRequirements extracts security requirement names
func (p *OpenHandlerParser) extractSecurityRequirements(security []map[string][]string) []string {
	var result []string
	seen := make(map[string]bool)

	for _, req := range security {
		for name := range req {
			if !seen[name] {
				result = append(result, name)
				seen[name] = true
			}
		}
	}

	return result
}

// Helper functions
func (p *OpenHandlerParser) getStringField(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func (p *OpenHandlerParser) getBoolField(m map[string]interface{}, key string) bool {
	if val, ok := m[key].(bool); ok {
		return val
	}
	return false
}

func (p *OpenHandlerParser) convertToStringSlice(arr []interface{}) []string {
	var result []string
	for _, item := range arr {
		if str, ok := item.(string); ok {
			result = append(result, str)
		}
	}
	return result
}

// DetectFormat implements the UniversalParser interface
func (p *OpenHandlerParser) DetectFormat(input []byte) (string, error) {
	var doc map[string]interface{}
	if err := json.Unmarshal(input, &doc); err != nil {
		return "", fmt.Errorf("not a valid JSON document")
	}

	// Check for openhandler field
	if openhandler, ok := doc["openhandler"].(string); ok {
		if len(openhandler) > 0 {
			return "openhandler", nil
		}
	}

	// Check for handlers field with info
	if _, hasHandlers := doc["handlers"]; hasHandlers {
		if _, hasInfo := doc["info"]; hasInfo {
			return "openhandler", nil
		}
	}

	return "", fmt.Errorf("not an OpenHandler document")
}

// Validate implements the UniversalParser interface
func (p *OpenHandlerParser) Validate(ir *IntermediateRepresentation) (*ValidationResults, error) {
	validator := utils.NewIRValidator()

	// Validate metadata
	validator.ValidateMetadata(ir.Metadata.Name, ir.Metadata.Version, ir.Metadata.Title)

	// Validate endpoints
	for i, endpoint := range ir.Endpoints {
		validator.ValidateEndpoint(endpoint.ID, endpoint.Name, endpoint.Method, endpoint.Path, i)
	}

	// Validate auth schemes
	for i, auth := range ir.Auth {
		validator.ValidateAuthScheme(auth.Name, auth.Type, i)
	}

	// Validate servers
	for i, server := range ir.Servers {
		validator.ValidateServerConfig(server.URL, i)
	}

	// Validate type definitions
	for i, typeDef := range ir.Types {
		validator.ValidateTypeDefinition(typeDef.Name, typeDef.Type, i)
	}

	results := &ValidationResults{
		Valid:    validator.IsValid(),
		IsValid:  validator.IsValid(),
		Errors:   convertUtilsErrors(validator.GetErrors()),
		Warnings: convertUtilsErrors(validator.GetWarnings()),
		Info:     []ValidationError{},
		Infos:    []ValidationError{},
	}

	return results, nil
}

// GetFormat implements the UniversalParser interface
func (p *OpenHandlerParser) GetFormat() string {
	return "openhandler"
}

// GetVersion implements the UniversalParser interface
func (p *OpenHandlerParser) GetVersion() string {
	return p.version
}

// GetSupportedVersions implements the UniversalParser interface
func (p *OpenHandlerParser) GetSupportedVersions() []string {
	return []string{"1.0.0", "1.1.0", "1.2.0"}
}
