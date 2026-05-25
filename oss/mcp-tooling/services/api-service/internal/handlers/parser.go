package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/parser"
)

// ParseOpenAPISpecHandler handles OpenAPI specification parsing
func ParseOpenAPISpecHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the OpenAPI specification from the request body
		var req ParseSpecRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create parser
		openapiParser := parser.NewOpenAPIParser()

		var parsedSpec *parser.ParsedSpec
		var err error

		// Parse based on input type
		if req.URL != "" {
			// Parse from URL
			parsedSpec, err = openapiParser.ParseSpecFromURL(req.URL)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse OpenAPI specification from URL",
					"code":    "PARSE_URL_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else if req.Spec != "" {
			// Parse from specification content
			parsedSpec, err = openapiParser.ParseSpec(req.Spec)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse OpenAPI specification",
					"code":    "PARSE_SPEC_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'spec' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		// Return the parsed specification
		c.JSON(http.StatusOK, gin.H{
			"spec":    parsedSpec,
			"success": true,
		})
	}
}

// ValidateOpenAPISpecHandler handles OpenAPI specification validation
func ValidateOpenAPISpecHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the OpenAPI specification from the request body
		var req ParseSpecRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create parser
		openapiParser := parser.NewOpenAPIParser()

		var parsedSpec *parser.ParsedSpec
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSpec, err = openapiParser.ParseSpecFromURL(req.URL)
		} else if req.Spec != "" {
			parsedSpec, err = openapiParser.ParseSpec(req.Spec)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'spec' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"valid":  false,
				"errors": []string{err.Error()},
				"spec":   nil,
			})
			return
		}

		// Return only validation results
		c.JSON(http.StatusOK, gin.H{
			"valid":    parsedSpec.Validation.IsValid,
			"errors":   parsedSpec.Validation.Errors,
			"warnings": parsedSpec.Validation.Warnings,
			"infos":    parsedSpec.Validation.Infos,
			"metadata": parsedSpec.Metadata,
		})
	}
}

// ExtractEndpointsHandler handles endpoint extraction from OpenAPI specs
func ExtractEndpointsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the OpenAPI specification from the request body
		var req ParseSpecRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create parser
		openapiParser := parser.NewOpenAPIParser()

		var parsedSpec *parser.ParsedSpec
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSpec, err = openapiParser.ParseSpecFromURL(req.URL)
		} else if req.Spec != "" {
			parsedSpec, err = openapiParser.ParseSpec(req.Spec)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'spec' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse OpenAPI specification",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Apply filters if provided
		endpoints := parsedSpec.Endpoints
		if req.Filter != nil {
			endpoints = filterEndpoints(endpoints, req.Filter)
		}

		// Return the extracted endpoints
		c.JSON(http.StatusOK, gin.H{
			"endpoints": endpoints,
			"total":     len(endpoints),
			"metadata":  parsedSpec.Metadata,
		})
	}
}

// GenerateMCPSchemaHandler handles MCP schema generation from OpenAPI specs
func GenerateMCPSchemaHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the OpenAPI specification from the request body
		var req GenerateMCPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create parser
		openapiParser := parser.NewOpenAPIParser()

		var parsedSpec *parser.ParsedSpec
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSpec, err = openapiParser.ParseSpecFromURL(req.URL)
		} else if req.Spec != "" {
			parsedSpec, err = openapiParser.ParseSpec(req.Spec)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'spec' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse OpenAPI specification",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Generate MCP schema
		mcpSchema := generateMCPSchema(parsedSpec, req)

		// Return the generated MCP schema
		c.JSON(http.StatusOK, gin.H{
			"mcp_schema": mcpSchema,
			"metadata":   parsedSpec.Metadata,
			"success":    true,
		})
	}
}

// Request/Response types

type ParseSpecRequest struct {
	Spec   string          `json:"spec,omitempty"`
	URL    string          `json:"url,omitempty"`
	Filter *EndpointFilter `json:"filter,omitempty"`
}

type GenerateMCPRequest struct {
	Spec           string             `json:"spec,omitempty"`
	URL            string             `json:"url,omitempty"`
	Runtime        string             `json:"runtime"` // go, typescript, docker
	Authentication *AuthConfig        `json:"authentication,omitempty"`
	Options        *GenerationOptions `json:"options,omitempty"`
}

type EndpointFilter struct {
	Methods    []string `json:"methods,omitempty"`
	Path       string   `json:"path,omitempty"`
	Tags       []string `json:"tags,omitempty"`
	Deprecated *bool    `json:"deprecated,omitempty"`
}

type AuthConfig struct {
	Type        string            `json:"type"` // api_key, oauth2, bearer, none
	APIKey      *APIKeyAuth       `json:"api_key,omitempty"`
	OAuth2      *OAuth2Auth       `json:"oauth2,omitempty"`
	Bearer      *BearerAuth       `json:"bearer,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	QueryParams map[string]string `json:"query_params,omitempty"`
}

type APIKeyAuth struct {
	Name  string `json:"name"`
	In    string `json:"in"` // header, query
	Value string `json:"value"`
}

type OAuth2Auth struct {
	ClientID     string   `json:"client_id"`
	ClientSecret string   `json:"client_secret"`
	AuthURL      string   `json:"auth_url"`
	TokenURL     string   `json:"token_url"`
	Scopes       []string `json:"scopes"`
}

type BearerAuth struct {
	Token string `json:"token"`
}

type GenerationOptions struct {
	IncludeTests    bool     `json:"include_tests"`
	IncludeDocs     bool     `json:"include_docs"`
	Validation      string   `json:"validation"`    // strict, lenient, none
	OutputFormat    string   `json:"output_format"` // json, yaml, toml
	CustomTemplates []string `json:"custom_templates,omitempty"`
	ExcludePatterns []string `json:"exclude_patterns,omitempty"`
}

type MCPSchema struct {
	Name           string                 `json:"name"`
	Description    string                 `json:"description"`
	Version        string                 `json:"version"`
	Runtime        string                 `json:"runtime"`
	Tools          []MCPTool              `json:"tools"`
	Authentication *AuthConfig            `json:"authentication,omitempty"`
	Resources      []MCPResource          `json:"resources,omitempty"`
	Prompts        []MCPPrompt            `json:"prompts,omitempty"`
	Metadata       map[string]interface{} `json:"metadata"`
}

type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Method      string                 `json:"method"`
	Path        string                 `json:"path"`
	Headers     map[string]string      `json:"headers,omitempty"`
	Parameters  []MCPParameter         `json:"parameters,omitempty"`
}

type MCPParameter struct {
	Name        string      `json:"name"`
	Type        string      `json:"type"`
	Description string      `json:"description,omitempty"`
	Required    bool        `json:"required"`
	Default     interface{} `json:"default,omitempty"`
}

type MCPResource struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URI         string `json:"uri"`
	MimeType    string `json:"mimeType"`
}

type MCPPrompt struct {
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Arguments   []MCPArgument `json:"arguments,omitempty"`
}

type MCPArgument struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// GraphQL Request/Response types

type ParseGraphQLRequest struct {
	Schema        string                  `json:"schema,omitempty"`
	URL           string                  `json:"url,omitempty"`
	Introspection map[string]interface{}  `json:"introspection,omitempty"`
	Filter        *GraphQLOperationFilter `json:"filter,omitempty"`
}

type GenerateGraphQLMCPRequest struct {
	Schema         string                 `json:"schema,omitempty"`
	URL            string                 `json:"url,omitempty"`
	Introspection  map[string]interface{} `json:"introspection,omitempty"`
	Runtime        string                 `json:"runtime"` // go, typescript, docker
	Authentication *AuthConfig            `json:"authentication,omitempty"`
	Options        *GenerationOptions     `json:"options,omitempty"`
}

type GraphQLOperationFilter struct {
	Types      []string `json:"types,omitempty"`  // query, mutation, subscription
	Fields     []string `json:"fields,omitempty"` // field names
	Deprecated *bool    `json:"deprecated,omitempty"`
}

// Postman Request/Response types

type ParsePostmanRequest struct {
	Collection string                `json:"collection,omitempty"`
	URL        string                `json:"url,omitempty"`
	Filter     *PostmanRequestFilter `json:"filter,omitempty"`
}

type GeneratePostmanMCPRequest struct {
	Collection     string             `json:"collection,omitempty"`
	URL            string             `json:"url,omitempty"`
	Runtime        string             `json:"runtime"` // go, typescript, docker
	Authentication *AuthConfig        `json:"authentication,omitempty"`
	Options        *GenerationOptions `json:"options,omitempty"`
}

type PostmanRequestFilter struct {
	Methods []string `json:"methods,omitempty"`  // GET, POST, PUT, DELETE, etc.
	Names   []string `json:"names,omitempty"`    // request names
	Folders []string `json:"folders,omitempty"`  // folder names
	HasAuth *bool    `json:"has_auth,omitempty"` // filter by authentication
	HasBody *bool    `json:"has_body,omitempty"` // filter by request body
}

// Helper functions

func filterEndpoints(endpoints []parser.Endpoint, filter *EndpointFilter) []parser.Endpoint {
	if filter == nil {
		return endpoints
	}

	var filtered []parser.Endpoint

	for _, endpoint := range endpoints {
		// Filter by methods
		if len(filter.Methods) > 0 {
			found := false
			for _, method := range filter.Methods {
				if strings.EqualFold(endpoint.Method, method) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by path pattern
		if filter.Path != "" {
			if !strings.Contains(endpoint.Path, filter.Path) {
				continue
			}
		}

		// Filter by deprecated status
		if filter.Deprecated != nil {
			// Note: This would need to be added to the parser.Endpoint struct
			// For now, we'll skip this filter
		}

		filtered = append(filtered, endpoint)
	}

	return filtered
}

func generateMCPSchema(parsedSpec *parser.ParsedSpec, req GenerateMCPRequest) MCPSchema {
	runtime := req.Runtime
	if runtime == "" {
		runtime = "go" // Default runtime
	}

	mcpSchema := MCPSchema{
		Name:           generateSchemaName(parsedSpec.Info.Title),
		Description:    parsedSpec.Info.Description,
		Version:        parsedSpec.Info.Version,
		Runtime:        runtime,
		Tools:          []MCPTool{},
		Authentication: req.Authentication,
		Resources:      []MCPResource{},
		Prompts:        []MCPPrompt{},
		Metadata: map[string]interface{}{
			"category":         parsedSpec.Metadata["Category"],
			"total_endpoints":  parsedSpec.Metadata["TotalEndpoints"],
			"complexity_score": parsedSpec.Metadata["ComplexityScore"],
			"estimated_time":   parsedSpec.Metadata["EstimatedTime"],
			"base_url":         parsedSpec.Metadata["BaseURL"],
			"http_methods":     parsedSpec.Metadata["HTTPMethods"],
			"data_types":       parsedSpec.Metadata["DataTypes"],
			"original_title":   parsedSpec.Info.Title,
			"generated_at":     "now", // Would be actual timestamp
		},
	}

	// Generate tools from endpoints
	for _, endpoint := range parsedSpec.Endpoints {
		tool := MCPTool{
			Name:        endpoint.Name,
			Description: endpoint.Description,
			InputSchema: generateInputSchema(endpoint),
			Method:      endpoint.Method,
			Path:        endpoint.Path,
			Headers:     generateHeaders(req.Authentication),
			Parameters:  generateMCPParameters(endpoint),
		}

		mcpSchema.Tools = append(mcpSchema.Tools, tool)
	}

	// Generate resources based on common patterns
	mcpSchema.Resources = generateResources(parsedSpec)

	// Generate prompts based on API capabilities
	mcpSchema.Prompts = generatePrompts(parsedSpec)

	return mcpSchema
}

func generateSchemaName(title string) string {
	if title == "" {
		return "api-connector"
	}

	// Convert to a suitable schema name
	name := strings.ToLower(title)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")

	// Remove special characters
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result += string(r)
		}
	}

	if result == "" {
		return "api-connector"
	}

	return result + "-connector"
}

func generateInputSchema(endpoint parser.Endpoint) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
		"required":   []string{},
	}

	properties := schema["properties"].(map[string]interface{})
	required := schema["required"].([]string)

	// Add path parameters
	for _, param := range endpoint.Parameters {
		if param.In == "path" {
			paramSchema := map[string]interface{}{
				"type":        inferType(param.Schema),
				"description": param.Description,
			}

			if param.Schema != nil {
				// Default not supported in current TypeReference
			}

			properties[param.Name] = paramSchema

			if param.Required {
				required = append(required, param.Name)
			}
		}
	}

	// Add query parameters
	queryProps := map[string]interface{}{}
	queryRequired := []string{}

	for _, param := range endpoint.Parameters {
		if param.In == "query" {
			paramSchema := map[string]interface{}{
				"type":        inferType(param.Schema),
				"description": param.Description,
			}

			if param.Schema != nil {
				// Default not supported in current TypeReference
			}

			queryProps[param.Name] = paramSchema

			if param.Required {
				queryRequired = append(queryRequired, param.Name)
			}
		}
	}

	if len(queryProps) > 0 {
		properties["query"] = map[string]interface{}{
			"type":       "object",
			"properties": queryProps,
			"required":   queryRequired,
		}
	}

	// Add request body
	// Add request body
	if endpoint.RequestBody != nil && endpoint.RequestBody.Schema != nil {
		bodySchema := convertSchemaReferenceToJSONSchema(endpoint.RequestBody.Schema)
		if bodySchema != nil {
			properties["body"] = bodySchema
			required = append(required, "body")
		}
	}

	schema["required"] = required
	return schema
}

func generateHeaders(auth *AuthConfig) map[string]string {
	headers := map[string]string{
		"Content-Type": "application/json",
		"User-Agent":   "MCPOverflow-Connector/1.0",
	}

	if auth != nil {
		switch auth.Type {
		case "api_key":
			if auth.APIKey != nil {
				if auth.APIKey.In == "header" {
					headers[auth.APIKey.Name] = auth.APIKey.Value
				}
			}
		case "bearer":
			if auth.Bearer != nil {
				headers["Authorization"] = "Bearer " + auth.Bearer.Token
			}
		}

		// Add custom headers
		for key, value := range auth.Headers {
			headers[key] = value
		}
	}

	return headers
}

func generateMCPParameters(endpoint parser.Endpoint) []MCPParameter {
	var params []MCPParameter

	for _, param := range endpoint.Parameters {
		if param.In == "path" || param.In == "query" {
			mcpParam := MCPParameter{
				Name:        param.Name,
				Type:        inferType(param.Schema),
				Description: param.Description,
				Required:    param.Required,
			}

			if param.Schema != nil {
				// Default not supported in current TypeReference
			}

			params = append(params, mcpParam)
		}
	}

	return params
}

func generateResources(parsedSpec *parser.ParsedSpec) []MCPResource {
	var resources []MCPResource

	// Generate common resources based on API patterns
	for _, endpoint := range parsedSpec.Endpoints {
		if strings.Contains(endpoint.Path, "/{id}") && endpoint.Method == "get" {
			// Likely a resource endpoint
			resourceName := extractResourceName(endpoint.Path)
			resources = append(resources, MCPResource{
				Name:        resourceName,
				Description: "Access " + resourceName + " resources",
				URI:         "api://" + resourceName + "/{id}",
				MimeType:    "application/json",
			})
		}
	}

	return resources
}

func generatePrompts(parsedSpec *parser.ParsedSpec) []MCPPrompt {
	var prompts []MCPPrompt

	// Add common prompts based on API capabilities
	if len(parsedSpec.Endpoints) > 0 {
		prompts = append(prompts, MCPPrompt{
			Name:        fmt.Sprintf("list_%s", parsedSpec.Metadata["Category"]),
			Description: fmt.Sprintf("List available %s resources", parsedSpec.Metadata["Category"]),
		})

		prompts = append(prompts, MCPPrompt{
			Name:        fmt.Sprintf("get_%s", parsedSpec.Metadata["Category"]),
			Description: fmt.Sprintf("Get details of a specific %s resource", parsedSpec.Metadata["Category"]),
			Arguments: []MCPArgument{
				{
					Name:        "id",
					Description: "The ID of the resource to retrieve",
					Required:    true,
				},
			},
		})
	}

	return prompts
}

func convertSchemaReferenceToJSONSchema(ref *parser.TypeReference) map[string]interface{} {
	if ref == nil {
		return nil
	}

	result := map[string]interface{}{
		"type": ref.Type,
	}
	
	if ref.Ref != "" {
		result["$ref"] = ref.Ref
	}

	return result
}

func inferType(ref *parser.TypeReference) string {
	if ref == nil {
		return "string"
	}

	if ref.Type != "" {
		switch ref.Type {
		case "integer":
			return "number"
		case "int64":
			return "number"
		default:
			return ref.Type
		}
	}

	return "string" // Default fallback
}

func convertSchemaToJSONSchema(schema *parser.Schema) map[string]interface{} {
	if schema == nil {
		return nil
	}

	result := map[string]interface{}{
		"type":        schema.Type,
		"description": schema.Description,
		"title":       schema.Title,
	}

	if schema.Default != nil {
		result["default"] = schema.Default
	}

	if schema.Type == "array" && schema.Items != nil {
		result["items"] = convertSchemaToJSONSchema(schema.Items)
	}

	if schema.Type == "object" && len(schema.Properties) > 0 {
		properties := make(map[string]interface{})
		for name, propSchema := range schema.Properties {
			properties[name] = convertSchemaToJSONSchema(propSchema)
		}
		result["properties"] = properties
		result["required"] = schema.Required
	}

	// Add enum if present
	if len(schema.Enum) > 0 {
		result["enum"] = schema.Enum
	}

	return result
}

func extractResourceName(path string) string {
	// Extract resource name from path like "/users/{id}" -> "user"
	parts := strings.Split(strings.Trim(path, "/"), "/")
	for i, part := range parts {
		if strings.Contains(part, "{") && strings.Contains(part, "}") && i > 0 {
			// Return the part before the parameter
			return strings.ToLower(parts[i-1])
		}
	}
	return "resource"
}

// GraphQL Helper functions

func filterGraphQLOperations(operations []parser.GraphQLOperation, filter *GraphQLOperationFilter) []parser.GraphQLOperation {
	if filter == nil {
		return operations
	}

	var filtered []parser.GraphQLOperation

	for _, operation := range operations {
		// Filter by operation types
		if len(filter.Types) > 0 {
			found := false
			for _, opType := range filter.Types {
				if strings.EqualFold(operation.Type, opType) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by field names
		if len(filter.Fields) > 0 {
			found := false
			for _, field := range filter.Fields {
				if strings.Contains(operation.Name, field) || strings.Contains(operation.Description, field) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by deprecated status
		if filter.Deprecated != nil {
			// Note: This would need to be added to the parser.GraphQLOperation struct
			// For now, we'll skip this filter
		}

		filtered = append(filtered, operation)
	}

	return filtered
}

// Postman Helper functions

func filterPostmanEndpoints(endpoints []parser.Endpoint, filter *PostmanRequestFilter) []parser.Endpoint {
	if filter == nil {
		return endpoints
	}

	var filtered []parser.Endpoint

	for _, endpoint := range endpoints {
		// Filter by HTTP methods
		if len(filter.Methods) > 0 {
			found := false
			for _, method := range filter.Methods {
				if strings.EqualFold(endpoint.Method, method) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by request names
		if len(filter.Names) > 0 {
			found := false
			for _, name := range filter.Names {
				if strings.Contains(endpoint.Name, name) || strings.Contains(endpoint.Description, name) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by authentication requirement
		if filter.HasAuth != nil {
			hasAuth := len(endpoint.Parameters) > 0
			// This is a simplified check - in practice, you'd check for auth headers/parameters
			if *filter.HasAuth != hasAuth {
				continue
			}
		}

		// Filter by body requirement
		if filter.HasBody != nil {
			hasBody := false
			// Check if any parameter is in body/formData
			for _, param := range endpoint.Parameters {
				if param.In == "body" || param.In == "formData" {
					hasBody = true
					break
				}
			}
			if *filter.HasBody != hasBody {
				continue
			}
		}

		filtered = append(filtered, endpoint)
	}

	return filtered
}

func generatePostmanMCPSchema(parsedCollection *parser.ParsedPostmanCollection, req GeneratePostmanMCPRequest) MCPSchema {
	runtime := req.Runtime
	if runtime == "" {
		runtime = "go" // Default runtime
	}

	mcpSchema := MCPSchema{
		Name:           generatePostmanSchemaName(parsedCollection.Info.Name),
		Description:    parsedCollection.Info.Description,
		Version:        parsedCollection.Info.Version,
		Runtime:        runtime,
		Tools:          []MCPTool{},
		Authentication: req.Authentication,
		Resources:      []MCPResource{},
		Prompts:        []MCPPrompt{},
		Metadata: map[string]interface{}{
			"type":             "postman",
			"collection_name":  parsedCollection.Info.Name,
			"total_requests":   parsedCollection.Metadata.TotalRequests,
			"total_folders":    parsedCollection.Metadata.TotalFolders,
			"complexity_score": parsedCollection.Metadata.ComplexityScore,
			"estimated_time":   parsedCollection.Metadata.EstimatedTime,
			"http_methods":     parsedCollection.Metadata.HTTPMethods,
			"has_variables":    parsedCollection.Metadata.HasVariables,
			"has_scripts":      parsedCollection.Metadata.HasScripts,
			"generated_at":     "now", // Would be actual timestamp
		},
	}

	// Generate tools from Postman requests
	for _, endpoint := range parsedCollection.Endpoints {
		tool := MCPTool{
			Name:        generatePostmanToolName(endpoint.Name),
			Description: endpoint.Description,
			InputSchema: generatePostmanInputSchema(endpoint),
			Method:      endpoint.Method,
			Path:        endpoint.Path,
			Headers:     generatePostmanHeaders(req.Authentication),
			Parameters:  generatePostmanParameters(endpoint),
		}

		mcpSchema.Tools = append(mcpSchema.Tools, tool)
	}

	// Generate resources based on Postman requests
	mcpSchema.Resources = generatePostmanResources(parsedCollection.Endpoints)

	// Generate prompts based on Postman collection capabilities
	mcpSchema.Prompts = generatePostmanPrompts(parsedCollection)

	return mcpSchema
}

func generatePostmanSchemaName(collectionName string) string {
	if collectionName == "" {
		return "postman-connector"
	}

	// Convert to a suitable schema name
	name := strings.ToLower(collectionName)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")

	// Remove special characters
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result += string(r)
		}
	}

	if result == "" {
		return "postman-connector"
	}

	return result + "-connector"
}

func generatePostmanToolName(requestName string) string {
	if requestName == "" {
		return "executeRequest"
	}

	// Convert to a suitable tool name
	name := strings.ToLower(requestName)
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, "-", "_")

	// Remove special characters and ensure valid Go identifier
	result := ""
	for i, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			if i == 0 && r >= '0' && r <= '9' {
				result += "r" // Prefix with 'r' if starts with digit
			}
			result += string(r)
		}
	}

	if result == "" {
		return "executeRequest"
	}

	return result
}

func generatePostmanInputSchema(endpoint parser.Endpoint) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
		"required":   []string{},
	}

	properties := schema["properties"].(map[string]interface{})
	required := schema["required"].([]string)

	// Add path parameters
	for _, param := range endpoint.Parameters {
		if param.In == "path" {
			paramSchema := map[string]interface{}{
				"type":        param.Schema.Type,
				"description": param.Description,
			}

			if param.Schema != nil {
				// Default not supported
			}

			properties[param.Name] = paramSchema

			if param.Required {
				required = append(required, param.Name)
			}
		}
	}

	// Add query parameters
	queryProps := map[string]interface{}{}
	queryRequired := []string{}

	for _, param := range endpoint.Parameters {
		if param.In == "query" {
			paramSchema := map[string]interface{}{
				"type":        param.Schema.Type,
				"description": param.Description,
			}

			if param.Schema != nil {
				// Default not supported
			}

			queryProps[param.Name] = paramSchema

			if param.Required {
				queryRequired = append(queryRequired, param.Name)
			}
		}
	}

	if len(queryProps) > 0 {
		properties["query"] = map[string]interface{}{
			"type":       "object",
			"properties": queryProps,
			"required":   queryRequired,
		}
	}

	// Add headers parameter
	headerProps := map[string]interface{}{}
	for _, param := range endpoint.Parameters {
		if param.In == "header" {
			headerProps[param.Name] = map[string]interface{}{
				"type":        param.Schema.Type,
				"description": param.Description,
			}
		}
	}

	if len(headerProps) > 0 {
		properties["headers"] = map[string]interface{}{
			"type":       "object",
			"properties": headerProps,
		}
	}

	// Add request body if present
	for _, param := range endpoint.Parameters {
		if param.In == "body" || param.In == "formData" {
			bodySchema := map[string]interface{}{
				"type":        "object",
				"description": "Request body",
			}
			properties["body"] = bodySchema
			required = append(required, "body")
			break
		}
	}

	schema["required"] = required
	return schema
}

func generatePostmanHeaders(auth *AuthConfig) map[string]string {
	headers := map[string]string{
		"Content-Type": "application/json",
		"User-Agent":   "MCPOverflow-Postman-Connector/1.0",
	}

	if auth != nil {
		switch auth.Type {
		case "api_key":
			if auth.APIKey != nil {
				if auth.APIKey.In == "header" {
					headers[auth.APIKey.Name] = auth.APIKey.Value
				}
			}
		case "bearer":
			if auth.Bearer != nil {
				headers["Authorization"] = "Bearer " + auth.Bearer.Token
			}
		}

		// Add custom headers
		for key, value := range auth.Headers {
			headers[key] = value
		}
	}

	return headers
}

func generatePostmanParameters(endpoint parser.Endpoint) []MCPParameter {
	var params []MCPParameter

	for _, param := range endpoint.Parameters {
		if param.In == "path" || param.In == "query" || param.In == "header" {
			mcpParam := MCPParameter{
				Name:        param.Name,
				Type:        param.Schema.Type,
				Description: param.Description,
				Required:    param.Required,
			}

			if param.Schema != nil {
				// Default not supported
			}

			params = append(params, mcpParam)
		}
	}

	return params
}

func generatePostmanResources(endpoints []parser.Endpoint) []MCPResource {
	var resources []MCPResource

	// Generate resources based on endpoint patterns
	for _, endpoint := range endpoints {
		if strings.Contains(endpoint.Path, "/{id}") && endpoint.Method == "GET" {
			// Likely a resource endpoint
			resourceName := extractResourceName(endpoint.Path)
			resources = append(resources, MCPResource{
				Name:        resourceName,
				Description: "Access " + resourceName + " resources from Postman collection",
				URI:         "postman://" + resourceName + "/{id}",
				MimeType:    "application/json",
			})
		}
	}

	return resources
}

func generatePostmanPrompts(parsedCollection *parser.ParsedPostmanCollection) []MCPPrompt {
	var prompts []MCPPrompt

	// Add common prompts based on Postman collection capabilities
	if parsedCollection.Metadata.TotalRequests > 0 {
		prompts = append(prompts, MCPPrompt{
			Name:        "execute_" + strings.ToLower(parsedCollection.Info.Name),
			Description: "Execute requests from " + parsedCollection.Info.Name + " Postman collection",
		})

		if parsedCollection.Metadata.HasVariables {
			prompts = append(prompts, MCPPrompt{
				Name:        "configure_variables",
				Description: "Configure variables for " + parsedCollection.Info.Name + " collection",
			})
		}

		if len(parsedCollection.Metadata.HTTPMethods) > 1 {
			prompts = append(prompts, MCPPrompt{
				Name:        "test_all_methods",
				Description: "Test all HTTP methods available in " + parsedCollection.Info.Name + " collection",
			})
		}
	}

	return prompts
}

func generateGraphQLMCPSchema(parsedSchema *parser.GraphQLSchema, req GenerateGraphQLMCPRequest) MCPSchema {
	runtime := req.Runtime
	if runtime == "" {
		runtime = "go" // Default runtime
	}

	mcpSchema := MCPSchema{
		Name:           generateGraphQLSchemaName(parsedSchema.Metadata.TypeName),
		Description:    fmt.Sprintf("GraphQL connector for %s", parsedSchema.Metadata.TypeName),
		Version:        "1.0.0",
		Runtime:        runtime,
		Tools:          []MCPTool{},
		Authentication: req.Authentication,
		Resources:      []MCPResource{},
		Prompts:        []MCPPrompt{},
		Metadata: map[string]interface{}{
			"type":              "graphql",
			"type_name":         parsedSchema.Metadata.TypeName,
			"total_operations":  parsedSchema.Metadata.TotalOperations,
			"total_types":       parsedSchema.Metadata.TotalTypes,
			"complexity_score":  parsedSchema.Metadata.ComplexityScore,
			"estimated_time":    parsedSchema.Metadata.EstimatedTime,
			"operation_types":   parsedSchema.Metadata.OperationTypes,
			"has_subscriptions": parsedSchema.Metadata.HasSubscriptions,
			"generated_at":      "now", // Would be actual timestamp
		},
	}

	// Generate tools from GraphQL operations
	for _, operation := range parsedSchema.Operations {
		tool := MCPTool{
			Name:        operation.Name,
			Description: operation.Description,
			InputSchema: generateGraphQLInputSchema(operation),
			Method:      "POST", // GraphQL uses POST for all operations
			Path:        "/graphql",
			Headers:     generateGraphQLHeaders(req.Authentication),
			Parameters:  generateGraphQLParameters(operation),
		}

		mcpSchema.Tools = append(mcpSchema.Tools, tool)
	}

	// Generate resources based on GraphQL types
	mcpSchema.Resources = generateGraphQLResources(parsedSchema)

	// Generate prompts based on GraphQL capabilities
	mcpSchema.Prompts = generateGraphQLPrompts(parsedSchema)

	return mcpSchema
}

func generateGraphQLSchemaName(typeName string) string {
	if typeName == "" {
		return "graphql-connector"
	}

	// Convert to a suitable schema name
	name := strings.ToLower(typeName)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")

	// Remove special characters
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result += string(r)
		}
	}

	if result == "" {
		return "graphql-connector"
	}

	return result + "-connector"
}

func generateGraphQLInputSchema(operation parser.GraphQLOperation) map[string]interface{} {
	schema := map[string]interface{}{
		"type":       "object",
		"properties": map[string]interface{}{},
		"required":   []string{},
	}

	properties := schema["properties"].(map[string]interface{})
	required := schema["required"].([]string)

	// Add operation type
	properties["operation_type"] = map[string]interface{}{
		"type":        "string",
		"description": "GraphQL operation type",
		"enum":        []string{operation.Type},
	}

	// Add query field
	properties["query"] = map[string]interface{}{
		"type":        "string",
		"description": "GraphQL query string",
	}

	// Add variables if operation has arguments
	if len(operation.Arguments) > 0 {
		varProps := map[string]interface{}{}
		varRequired := []string{}

		for _, arg := range operation.Arguments {
			argSchema := map[string]interface{}{
				"type":        inferGraphQLType(arg.Type),
				"description": arg.Description,
			}

			if arg.Default != nil {
				argSchema["default"] = arg.Default
			}

			varProps[arg.Name] = argSchema

			if arg.Required {
				varRequired = append(varRequired, arg.Name)
			}
		}

		if len(varProps) > 0 {
			properties["variables"] = map[string]interface{}{
				"type":       "object",
				"properties": varProps,
				"required":   varRequired,
			}
		}
	}

	required = append(required, "query")
	schema["required"] = required

	return schema
}

func generateGraphQLHeaders(auth *AuthConfig) map[string]string {
	headers := map[string]string{
		"Content-Type": "application/json",
		"User-Agent":   "MCPOverflow-GraphQL-Connector/1.0",
	}

	if auth != nil {
		switch auth.Type {
		case "api_key":
			if auth.APIKey != nil {
				if auth.APIKey.In == "header" {
					headers[auth.APIKey.Name] = auth.APIKey.Value
				}
			}
		case "bearer":
			if auth.Bearer != nil {
				headers["Authorization"] = "Bearer " + auth.Bearer.Token
			}
		}

		// Add custom headers
		for key, value := range auth.Headers {
			headers[key] = value
		}
	}

	return headers
}

func generateGraphQLParameters(operation parser.GraphQLOperation) []MCPParameter {
	var params []MCPParameter

	// Add operation parameter
	params = append(params, MCPParameter{
		Name:        "operation_type",
		Type:        "string",
		Description: "GraphQL operation type (query, mutation, subscription)",
		Required:    true,
		Default:     operation.Type,
	})

	// Add query parameter
	params = append(params, MCPParameter{
		Name:        "query",
		Type:        "string",
		Description: "GraphQL query string",
		Required:    true,
	})

	// Add variables parameter if there are arguments
	if len(operation.Arguments) > 0 {
		params = append(params, MCPParameter{
			Name:        "variables",
			Type:        "object",
			Description: "Variables for the GraphQL operation",
			Required:    false,
		})
	}

	return params
}

func generateGraphQLResources(parsedSchema *parser.GraphQLSchema) []MCPResource {
	var resources []MCPResource

	// Generate resources based on GraphQL types
	for _, typeDef := range parsedSchema.Types {
		if strings.HasSuffix(typeDef.Name, "Query") || strings.HasSuffix(typeDef.Name, "Type") {
			// Likely a queryable type
			resourceName := strings.TrimSuffix(typeDef.Name, "Query")
			resourceName = strings.TrimSuffix(resourceName, "Type")
			resources = append(resources, MCPResource{
				Name:        resourceName,
				Description: fmt.Sprintf("Access %s resources via GraphQL", resourceName),
				URI:         fmt.Sprintf("graphql://%s", resourceName),
				MimeType:    "application/json",
			})
		}
	}

	return resources
}

func generateGraphQLPrompts(parsedSchema *parser.GraphQLSchema) []MCPPrompt {
	var prompts []MCPPrompt

	// Add common prompts based on GraphQL capabilities
	if len(parsedSchema.Operations) > 0 {
		prompts = append(prompts, MCPPrompt{
			Name:        "query_" + parsedSchema.Metadata.TypeName,
			Description: fmt.Sprintf("Query %s data using GraphQL", parsedSchema.Metadata.TypeName),
		})

		// Add mutation prompt if mutations exist
		hasMutations := false
		for _, op := range parsedSchema.Operations {
			if op.Type == "mutation" {
				hasMutations = true
				break
			}
		}

		if hasMutations {
			prompts = append(prompts, MCPPrompt{
				Name:        "mutate_" + parsedSchema.Metadata.TypeName,
				Description: fmt.Sprintf("Modify %s data using GraphQL mutations", parsedSchema.Metadata.TypeName),
			})
		}

		// Add subscription prompt if subscriptions exist
		if parsedSchema.Metadata.HasSubscriptions {
			prompts = append(prompts, MCPPrompt{
				Name:        "subscribe_" + parsedSchema.Metadata.TypeName,
				Description: fmt.Sprintf("Subscribe to %s data changes using GraphQL subscriptions", parsedSchema.Metadata.TypeName),
			})
		}
	}

	return prompts
}

func inferGraphQLType(graphqlType string) string {
	// Convert GraphQL type to JSON schema type
	if strings.HasPrefix(graphqlType, "Int") || strings.HasPrefix(graphqlType, "Float") {
		return "number"
	}
	if strings.HasPrefix(graphqlType, "Boolean") {
		return "boolean"
	}
	if strings.HasPrefix(graphqlType, "[") {
		return "array"
	}
	if strings.HasPrefix(graphqlType, "{") {
		return "object"
	}
	return "string"
}

// Postman Handlers

// ParsePostmanCollectionHandler handles Postman collection parsing
func ParsePostmanCollectionHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the Postman collection from the request body
		var req ParsePostmanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create Postman parser
		postmanParser := parser.NewPostmanParser()

		var parsedCollection *parser.ParsedPostmanCollection
		var err error

		// Parse based on input type
		if req.URL != "" {
			// Parse from URL
			parsedCollection, err = postmanParser.ParsePostmanCollectionFromURL(req.URL)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse Postman collection from URL",
					"code":    "PARSE_URL_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else if req.Collection != "" {
			// Parse from collection content
			parsedCollection, err = postmanParser.ParsePostmanCollection(req.Collection)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse Postman collection",
					"code":    "PARSE_COLLECTION_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'collection' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		// Return the parsed collection
		c.JSON(http.StatusOK, gin.H{
			"collection": parsedCollection,
			"success":    true,
		})
	}
}

// ValidatePostmanCollectionHandler handles Postman collection validation
func ValidatePostmanCollectionHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the Postman collection from the request body
		var req ParsePostmanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create Postman parser
		postmanParser := parser.NewPostmanParser()

		var parsedCollection *parser.ParsedPostmanCollection
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollectionFromURL(req.URL)
		} else if req.Collection != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollection(req.Collection)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'collection' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"valid":      false,
				"errors":     []string{err.Error()},
				"collection": nil,
			})
			return
		}

		// Return validation results
		c.JSON(http.StatusOK, gin.H{
			"valid":    parsedCollection.Validation.IsValid,
			"errors":   parsedCollection.Validation.Errors,
			"warnings": parsedCollection.Validation.Warnings,
			"infos":    parsedCollection.Validation.Infos,
			"metadata": parsedCollection.Metadata,
		})
	}
}

// ExtractPostmanRequestsHandler handles request extraction from Postman collections
func ExtractPostmanRequestsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the Postman collection from the request body
		var req ParsePostmanRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create Postman parser
		postmanParser := parser.NewPostmanParser()

		var parsedCollection *parser.ParsedPostmanCollection
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollectionFromURL(req.URL)
		} else if req.Collection != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollection(req.Collection)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'collection' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse Postman collection",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Apply filters if provided
		endpoints := parsedCollection.Endpoints
		if req.Filter != nil {
			endpoints = filterPostmanEndpoints(endpoints, req.Filter)
		}

		// Return the extracted requests
		c.JSON(http.StatusOK, gin.H{
			"requests": endpoints,
			"total":    len(endpoints),
			"metadata": parsedCollection.Metadata,
		})
	}
}

// GeneratePostmanMCPSchemaHandler handles MCP schema generation from Postman collections
func GeneratePostmanMCPSchemaHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the Postman collection from the request body
		var req GeneratePostmanMCPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create Postman parser
		postmanParser := parser.NewPostmanParser()

		var parsedCollection *parser.ParsedPostmanCollection
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollectionFromURL(req.URL)
		} else if req.Collection != "" {
			parsedCollection, err = postmanParser.ParsePostmanCollection(req.Collection)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'collection' or 'url' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse Postman collection",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Generate MCP schema
		mcpSchema := generatePostmanMCPSchema(parsedCollection, req)

		// Return the generated MCP schema
		c.JSON(http.StatusOK, gin.H{
			"mcp_schema": mcpSchema,
			"metadata":   parsedCollection.Metadata,
			"success":    true,
		})
	}
}

// GraphQL Handlers

// ParseGraphQLSchemaHandler handles GraphQL schema parsing
func ParseGraphQLSchemaHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the GraphQL schema from the request body
		var req ParseGraphQLRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create GraphQL parser
		graphqlParser := parser.NewGraphQLParser()

		var parsedSchema *parser.GraphQLSchema
		var err error

		// Parse based on input type
		if req.URL != "" {
			// Parse from URL
			parsedSchema, err = graphqlParser.ParseFromURL(req.URL)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse GraphQL schema from URL",
					"code":    "PARSE_URL_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else if req.Schema != "" {
			// Parse from schema content
			parsedSchema, err = graphqlParser.ParseGraphQLSchema(req.Schema)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse GraphQL schema",
					"code":    "PARSE_SCHEMA_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else if req.Introspection != nil {
			// Parse from introspection data
			introspectionJSON, err := json.Marshal(req.Introspection)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid introspection data format",
					"code":    "INVALID_INTROSPECTION",
					"details": err.Error(),
				})
				return
			}
			parsedSchema, err = graphqlParser.ParseIntrospection(string(introspectionJSON))
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Failed to parse GraphQL introspection data",
					"code":    "PARSE_INTROSPECTION_ERROR",
					"details": err.Error(),
				})
				return
			}
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'schema', 'url', or 'introspection' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		// Return the parsed schema
		c.JSON(http.StatusOK, gin.H{
			"schema":  parsedSchema,
			"success": true,
		})
	}
}

// ValidateGraphQLSchemaHandler handles GraphQL schema validation
func ValidateGraphQLSchemaHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the GraphQL schema from the request body
		var req ParseGraphQLRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create GraphQL parser
		graphqlParser := parser.NewGraphQLParser()

		var parsedSchema *parser.GraphQLSchema
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSchema, err = graphqlParser.ParseFromURL(req.URL)
		} else if req.Schema != "" {
			parsedSchema, err = graphqlParser.ParseGraphQLSchema(req.Schema)
		} else if req.Introspection != nil {
			introspectionJSON, err := json.Marshal(req.Introspection)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid introspection data format",
					"code":    "INVALID_INTROSPECTION",
					"details": err.Error(),
				})
				return
			}
			parsedSchema, err = graphqlParser.ParseIntrospection(string(introspectionJSON))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'schema', 'url', or 'introspection' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"valid":  false,
				"errors": []string{err.Error()},
				"schema": nil,
			})
			return
		}

		// Return validation results
		c.JSON(http.StatusOK, gin.H{
			"valid":    parsedSchema.Validation.IsValid,
			"errors":   parsedSchema.Validation.Errors,
			"warnings": parsedSchema.Validation.Warnings,
			"infos":    parsedSchema.Validation.Infos,
			"metadata": parsedSchema.Metadata,
		})
	}
}

// ExtractGraphQLOperationsHandler handles operations extraction from GraphQL schemas
func ExtractGraphQLOperationsHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the GraphQL schema from the request body
		var req ParseGraphQLRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create GraphQL parser
		graphqlParser := parser.NewGraphQLParser()

		var parsedSchema *parser.GraphQLSchema
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSchema, err = graphqlParser.ParseFromURL(req.URL)
		} else if req.Schema != "" {
			parsedSchema, err = graphqlParser.ParseGraphQLSchema(req.Schema)
		} else if req.Introspection != nil {
			introspectionJSON, err := json.Marshal(req.Introspection)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid introspection data format",
					"code":    "INVALID_INTROSPECTION",
					"details": err.Error(),
				})
				return
			}
			parsedSchema, err = graphqlParser.ParseIntrospection(string(introspectionJSON))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'schema', 'url', or 'introspection' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse GraphQL schema",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Apply filters if provided
		operations := parsedSchema.Operations
		if req.Filter != nil {
			operations = filterGraphQLOperations(operations, req.Filter)
		}

		// Return the extracted operations
		c.JSON(http.StatusOK, gin.H{
			"operations": operations,
			"total":      len(operations),
			"metadata":   parsedSchema.Metadata,
		})
	}
}

// GenerateGraphQLMCPSchemaHandler handles MCP schema generation from GraphQL schemas
func GenerateGraphQLMCPSchemaHandler(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get the GraphQL schema from the request body
		var req GenerateGraphQLMCPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid request format",
				"code":    "INVALID_REQUEST",
				"details": err.Error(),
			})
			return
		}

		// Create GraphQL parser
		graphqlParser := parser.NewGraphQLParser()

		var parsedSchema *parser.GraphQLSchema
		var err error

		// Parse based on input type
		if req.URL != "" {
			parsedSchema, err = graphqlParser.ParseFromURL(req.URL)
		} else if req.Schema != "" {
			parsedSchema, err = graphqlParser.ParseGraphQLSchema(req.Schema)
		} else if req.Introspection != nil {
			introspectionJSON, err := json.Marshal(req.Introspection)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid introspection data format",
					"code":    "INVALID_INTROSPECTION",
					"details": err.Error(),
				})
				return
			}
			parsedSchema, err = graphqlParser.ParseIntrospection(string(introspectionJSON))
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Either 'schema', 'url', or 'introspection' must be provided",
				"code":  "MISSING_INPUT",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to parse GraphQL schema",
				"code":    "PARSE_ERROR",
				"details": err.Error(),
			})
			return
		}

		// Generate MCP schema
		mcpSchema := generateGraphQLMCPSchema(parsedSchema, req)

		// Return the generated MCP schema
		c.JSON(http.StatusOK, gin.H{
			"mcp_schema": mcpSchema,
			"metadata":   parsedSchema.Metadata,
			"success":    true,
		})
	}
}
