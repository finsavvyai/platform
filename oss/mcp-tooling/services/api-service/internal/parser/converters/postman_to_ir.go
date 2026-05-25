package converters

import (
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// PostmanToIRConverter converts Postman collection to Intermediate Representation
type PostmanToIRConverter struct {
	version string
}

// NewPostmanToIRConverter creates a new Postman to IR converter
func NewPostmanToIRConverter() *PostmanToIRConverter {
	return &PostmanToIRConverter{
		version: "1.0.0",
	}
}

// Convert converts a ParsedPostmanCollection to IntermediateRepresentation
func (c *PostmanToIRConverter) Convert(collection *parser.ParsedPostmanCollection) (*parser.IntermediateRepresentation, error) {
	if collection == nil {
		return nil, fmt.Errorf("collection cannot be nil")
	}

	ir := &parser.IntermediateRepresentation{
		Metadata:   c.convertMetadata(collection),
		Endpoints:  c.convertEndpoints(collection),
		Types:      []parser.TypeDefinition{},
		Auth:       c.convertAuth(collection),
		Servers:    c.extractServers(collection),
		Globals:    c.convertGlobals(collection),
		Extensions: make(map[string]interface{}),
		Source: parser.SourceInfo{
			Format:        "postman",
			Version:       "2.1.0",
			ParserVersion: c.version,
			ParsedAt:      time.Now(),
		},
	}

	return ir, nil
}

// convertMetadata converts Postman collection info to IR metadata
func (c *PostmanToIRConverter) convertMetadata(collection *parser.ParsedPostmanCollection) parser.APIMetadata {
	return parser.APIMetadata{
		Name:        collection.Info.Name,
		Title:       collection.Info.Name,
		Description: collection.Info.Description,
		Version:     collection.Info.Version,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// convertEndpoints converts Postman items to IR endpoints
func (c *PostmanToIRConverter) convertEndpoints(collection *parser.ParsedPostmanCollection) []parser.UnifiedEndpoint {
	var endpoints []parser.UnifiedEndpoint

	for _, item := range collection.Items {
		endpoints = append(endpoints, c.convertItemsToEndpoints(item, "")...)
	}

	return endpoints
}

// convertItemsToEndpoints recursively converts Postman items to endpoints
func (c *PostmanToIRConverter) convertItemsToEndpoints(item parser.ParsedCollectionItem, parentPath string) []parser.UnifiedEndpoint {
	var endpoints []parser.UnifiedEndpoint

	if item.Request != nil {
		// This is a request item
		endpoint := c.convertRequest(item, parentPath)
		endpoints = append(endpoints, endpoint)
	} else {
		// This is a folder, process nested items
		newPath := item.Name
		if parentPath != "" {
			newPath = parentPath + "/" + item.Name
		}

		for _, nestedItem := range item.Items {
			endpoints = append(endpoints, c.convertItemsToEndpoints(nestedItem, newPath)...)
		}
	}

	return endpoints
}

// convertRequest converts a Postman request to IR endpoint
func (c *PostmanToIRConverter) convertRequest(item parser.ParsedCollectionItem, folder string) parser.UnifiedEndpoint {
	request := item.Request

	endpoint := parser.UnifiedEndpoint{
		ID:          c.generateID(request.Method, request.URL),
		Name:        item.Name,
		Description: request.Description,
		Method:      strings.ToUpper(request.Method),
		Path:        c.extractPath(request.URL),
		Parameters:  c.convertParameters(request),
		RequestBody: c.convertRequestBody(request),
		Responses: map[string]parser.ResponseSchema{
			"200": {
				Description: "Successful response",
			},
		},
		Auth:       c.extractAuthReferences(request.Auth),
		Tags:       c.createTags(folder),
		Extensions: make(map[string]interface{}),
	}

	return endpoint
}

// convertParameters converts Postman parameters to IR parameters
func (c *PostmanToIRConverter) convertParameters(request *parser.ParsedPostmanRequest) []parser.Parameter {
	var params []parser.Parameter

	// Add headers as parameters
	for _, header := range request.Headers {
		if !header.Disabled {
			params = append(params, parser.Parameter{
				Name:        header.Key,
				In:          "header",
				Description: header.Description,
				Required:    false,
				Schema: &parser.TypeDefinition{
					Type: "string",
				},
				Example: header.Value,
			})
		}
	}

	// Add query parameters from Parameters field
	for _, param := range request.Parameters {
		if param.In == "query" {
			params = append(params, param)
		}
	}

	return params
}

// convertRequestBody converts Postman body to IR request body
func (c *PostmanToIRConverter) convertRequestBody(request *parser.ParsedPostmanRequest) *parser.RequestBodySchema {
	if request.Body == nil {
		return nil
	}

	body := request.Body
	contentType := c.getContentType(body.Mode)

	reqBody := &parser.RequestBodySchema{
		Description: "Request body",
		Required:    true,
		Content: map[string]parser.MediaTypeSchema{
			contentType: {
				Schema: c.convertBodySchema(body),
			},
		},
	}

	return reqBody
}

// convertBodySchema converts Postman body to schema
func (c *PostmanToIRConverter) convertBodySchema(body *parser.PostmanBody) *parser.TypeDefinition {
	switch body.Mode {
	case "raw":
		// Try to infer type from raw content
		return &parser.TypeDefinition{
			Type:        "string",
			Description: "Raw request body",
		}

	case "formdata", "urlencoded":
		// Create object schema from form fields
		properties := make(map[string]*parser.TypeDefinition)
		var required []string

		var fields []interface{}
		if body.Mode == "formdata" {
			for _, f := range body.Formdata {
				fields = append(fields, f)
			}
		} else {
			for _, f := range body.URLencoded {
				fields = append(fields, f)
			}
		}

		for _, field := range fields {
			var key, desc string
			var disabled bool

			switch f := field.(type) {
			case parser.PostmanFormDataParam:
				key = f.Key
				desc = f.Description
				disabled = f.Disabled
			case parser.PostmanURLEncodedParam:
				key = f.Key
				desc = f.Description
				disabled = f.Disabled
			}

			if !disabled {
				properties[key] = &parser.TypeDefinition{
					Type:        "string",
					Description: desc,
				}
				required = append(required, key)
			}
		}

		return &parser.TypeDefinition{
			Type:       "object",
			Properties: properties,
			Required:   required,
		}

	default:
		return &parser.TypeDefinition{
			Type: "object",
		}
	}
}

// convertAuth converts Postman auth to IR auth schemes
func (c *PostmanToIRConverter) convertAuth(collection *parser.ParsedPostmanCollection) []parser.AuthScheme {
	var authSchemes []parser.AuthScheme

	if collection.Auth != nil {
		authScheme := c.convertAuthScheme("collection_auth", collection.Auth)
		if authScheme != nil {
			authSchemes = append(authSchemes, *authScheme)
		}
	}

	return authSchemes
}

// convertAuthScheme converts a single Postman auth to IR auth scheme
func (c *PostmanToIRConverter) convertAuthScheme(id string, auth *parser.PostmanAuth) *parser.AuthScheme {
	if auth == nil {
		return nil
	}

	authScheme := &parser.AuthScheme{
		ID:   id,
		Type: auth.Type,
	}

	switch auth.Type {
	case "apikey":
		if auth.APIKey != nil {
			authScheme.APIKey = &parser.APIKeyAuth{
				Name: auth.APIKey.Key,
				In:   auth.APIKey.In,
			}
		}

	case "bearer":
		authScheme.HTTP = &parser.HTTPAuth{
			Scheme:       "bearer",
			BearerFormat: "JWT",
		}

	case "basic":
		authScheme.HTTP = &parser.HTTPAuth{
			Scheme: "basic",
		}

	case "oauth2":
		if auth.OAuth2 != nil {
			authScheme.OAuth2 = &parser.OAuth2Auth{
				Flows: parser.OAuth2Flows{},
			}
		}
	}

	return authScheme
}

// extractServers extracts server configurations from Postman collection
func (c *PostmanToIRConverter) extractServers(collection *parser.ParsedPostmanCollection) []parser.ServerConfig {
	var servers []parser.ServerConfig

	if collection.Metadata.BaseURL != "" {
		servers = append(servers, parser.ServerConfig{
			URL:         collection.Metadata.BaseURL,
			Description: "Base URL from Postman collection",
			Protocol:    c.detectProtocol(collection.Metadata.BaseURL),
		})
	}

	return servers
}

// convertGlobals converts Postman global settings to IR globals
func (c *PostmanToIRConverter) convertGlobals(collection *parser.ParsedPostmanCollection) parser.GlobalConfig {
	globals := parser.GlobalConfig{
		Headers:    make(map[string]string),
		Parameters: []parser.Parameter{},
	}

	// Convert collection variables to global parameters
	for _, variable := range collection.Variables {
		if !variable.Disabled {
			globals.Parameters = append(globals.Parameters, parser.Parameter{
				Name:        variable.Key,
				In:          "query",
				Description: variable.Description,
				Required:    false,
				Schema: &parser.TypeDefinition{
					Type: "string",
				},
			})
		}
	}

	return globals
}

// Helper functions

func (c *PostmanToIRConverter) generateID(method, url string) string {
	// Simple ID generation from method and URL
	return fmt.Sprintf("%s_%s", strings.ToLower(method), strings.ReplaceAll(url, "/", "_"))
}

func (c *PostmanToIRConverter) extractPath(url string) string {
	// Extract path from URL
	// This is simplified - in reality would parse URL properly
	if strings.Contains(url, "://") {
		parts := strings.Split(url, "://")
		if len(parts) > 1 {
			pathParts := strings.SplitN(parts[1], "/", 2)
			if len(pathParts) > 1 {
				return "/" + pathParts[1]
			}
		}
	}
	return url
}

func (c *PostmanToIRConverter) extractAuthReferences(auth *parser.PostmanAuth) []string {
	if auth != nil {
		return []string{"collection_auth"}
	}
	return []string{}
}

func (c *PostmanToIRConverter) createTags(folder string) []string {
	if folder != "" {
		return []string{folder}
	}
	return []string{}
}

func (c *PostmanToIRConverter) getContentType(mode string) string {
	switch mode {
	case "raw":
		return "application/json"
	case "formdata":
		return "multipart/form-data"
	case "urlencoded":
		return "application/x-www-form-urlencoded"
	case "graphql":
		return "application/json"
	default:
		return "application/json"
	}
}

func (c *PostmanToIRConverter) detectProtocol(url string) string {
	if strings.HasPrefix(url, "https://") {
		return "https"
	}
	if strings.HasPrefix(url, "http://") {
		return "http"
	}
	if strings.HasPrefix(url, "wss://") {
		return "wss"
	}
	if strings.HasPrefix(url, "ws://") {
		return "ws"
	}
	return "https"
}
