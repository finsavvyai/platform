package converters

import (
	"fmt"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// OpenAPIToIRConverter converts OpenAPI ParsedSpec to Intermediate Representation
type OpenAPIToIRConverter struct {
	version string
}

// NewOpenAPIToIRConverter creates a new OpenAPI to IR converter
func NewOpenAPIToIRConverter() *OpenAPIToIRConverter {
	return &OpenAPIToIRConverter{
		version: "1.0.0",
	}
}

// Convert converts a ParsedSpec to IntermediateRepresentation
func (c *OpenAPIToIRConverter) Convert(spec *parser.ParsedSpec) (*parser.IntermediateRepresentation, error) {
	if spec == nil {
		return nil, fmt.Errorf("spec cannot be nil")
	}

	ir := &parser.IntermediateRepresentation{
		Metadata:   c.convertMetadata(spec),
		Endpoints:  c.convertEndpoints(spec),
		Types:      c.convertTypes(spec),
		Auth:       c.convertAuth(spec),
		Servers:    c.convertServers(spec),
		Globals:    c.convertGlobals(spec),
		Extensions: make(map[string]interface{}),
		Source: parser.SourceInfo{
			Format:        "openapi",
			Version:       c.detectOpenAPIVersion(spec),
			ParserVersion: c.version,
			ParsedAt:      time.Now(),
		},
	}

	return ir, nil
}

// convertMetadata converts OpenAPI info to IR metadata
func (c *OpenAPIToIRConverter) convertMetadata(spec *parser.ParsedSpec) parser.APIMetadata {
	metadata := parser.APIMetadata{
		Name:        spec.Info.Title,
		Title:       spec.Info.Title,
		Description: spec.Info.Description,
		Version:     spec.Info.Version,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if spec.Info.TermsOfService != "" {
		metadata.TermsOfService = spec.Info.TermsOfService
	}

	if spec.Info.Contact != nil {
		metadata.Contact = &parser.ContactInfo{
			Name:  spec.Info.Contact.Name,
			Email: spec.Info.Contact.Email,
			URL:   spec.Info.Contact.URL,
		}
	}

	if spec.Info.License != nil {
		metadata.License = &parser.LicenseInfo{
			Name: spec.Info.License.Name,
			URL:  spec.Info.License.URL,
		}
	}

	// Convert tags
	for _, tag := range spec.Tags {
		metadata.Tags = append(metadata.Tags, parser.Tag{
			Name:        tag.Name,
			Description: tag.Description,
		})
	}

	return metadata
}

// convertEndpoints converts OpenAPI paths to IR endpoints
func (c *OpenAPIToIRConverter) convertEndpoints(spec *parser.ParsedSpec) []parser.UnifiedEndpoint {
	var endpoints []parser.UnifiedEndpoint

	for path, pathItem := range spec.Paths {
		for method, operation := range pathItem.Operations {
			if operation == nil {
				continue
			}

			endpoint := parser.UnifiedEndpoint{
				ID:          operation.ID,
				Name:        c.generateEndpointName(operation, method, path),
				Description: c.getOperationDescription(operation),
				Method:      method,
				Path:        path,
				Parameters:  c.convertParameters(operation.Parameters),
				RequestBody: c.convertRequestBody(operation.RequestBody),
				Responses:   c.convertResponses(operation.Responses),
				Auth:        c.extractAuthReferences(operation.Security),
				Tags:        operation.Tags,
				Deprecated:  operation.Deprecated,
				Extensions:  make(map[string]interface{}),
			}

			endpoints = append(endpoints, endpoint)
		}
	}

	return endpoints
}

// convertParameters converts OpenAPI parameters to IR parameters
func (c *OpenAPIToIRConverter) convertParameters(params []parser.Parameter) []parser.Parameter {
	var irParams []parser.Parameter

	for _, param := range params {
		irParam := parser.Parameter{
			Name:        param.Name,
			In:          param.In,
			Description: param.Description,
			Required:    param.Required,
			Schema:      c.convertSchema(param.Schema),
			Default:     param.Default,
			Example:     param.Example,
			Style:       param.Style,
			Explode:     param.Explode,
			Deprecated:  param.Deprecated,
		}
		irParams = append(irParams, irParam)
	}

	return irParams
}

// convertRequestBody converts OpenAPI request body to IR request body
func (c *OpenAPIToIRConverter) convertRequestBody(reqBody *parser.RequestBody) *parser.RequestBodySchema {
	if reqBody == nil {
		return nil
	}

	irReqBody := &parser.RequestBodySchema{
		Description: reqBody.Description,
		Required:    reqBody.Required,
		Content:     make(map[string]parser.MediaTypeSchema),
	}

	for contentType, mediaType := range reqBody.Content {
		irReqBody.Content[contentType] = parser.MediaTypeSchema{
			Schema:   c.convertSchema(mediaType.Schema),
			Example:  mediaType.Example,
			Examples: c.convertExamples(mediaType.Examples),
		}
	}

	return irReqBody
}

// convertResponses converts OpenAPI responses to IR responses
func (c *OpenAPIToIRConverter) convertResponses(responses map[string]parser.Response) map[string]parser.ResponseSchema {
	irResponses := make(map[string]parser.ResponseSchema)

	for statusCode, response := range responses {
		irResponse := parser.ResponseSchema{
			Description: response.Description,
			Content:     make(map[string]parser.MediaTypeSchema),
			Headers:     make(map[string]parser.Parameter),
		}

		for contentType, mediaType := range response.Content {
			irResponse.Content[contentType] = parser.MediaTypeSchema{
				Schema:   c.convertSchema(mediaType.Schema),
				Example:  mediaType.Example,
				Examples: c.convertExamples(mediaType.Examples),
			}
		}

		for headerName, header := range response.Headers {
			irResponse.Headers[headerName] = parser.Parameter{
				Name:        headerName,
				In:          "header",
				Description: header.Description,
				Required:    header.Required,
				Schema:      c.convertSchema(header.Schema),
				Deprecated:  header.Deprecated,
			}
		}

		irResponses[statusCode] = irResponse
	}

	return irResponses
}

// convertSchema converts OpenAPI schema to IR type definition
func (c *OpenAPIToIRConverter) convertSchema(schema *parser.Schema) *parser.TypeDefinition {
	if schema == nil {
		return nil
	}

	typeDef := &parser.TypeDefinition{
		Type:        schema.Type,
		Format:      schema.Format,
		Description: schema.Description,
		Nullable:    schema.Nullable,
		ReadOnly:    schema.ReadOnly,
		WriteOnly:   schema.WriteOnly,
		Deprecated:  schema.Deprecated,
		Default:     schema.Default,
		Example:     schema.Example,
		Enum:        schema.Enum,
		Extensions:  make(map[string]interface{}),
	}

	// Validation constraints
	typeDef.Minimum = schema.Minimum
	typeDef.Maximum = schema.Maximum
	typeDef.ExclusiveMinimum = schema.ExclusiveMinimum
	typeDef.ExclusiveMaximum = schema.ExclusiveMaximum
	typeDef.MinLength = schema.MinLength
	typeDef.MaxLength = schema.MaxLength
	typeDef.Pattern = schema.Pattern
	typeDef.MinItems = schema.MinItems
	typeDef.MaxItems = schema.MaxItems
	typeDef.UniqueItems = schema.UniqueItems
	typeDef.MinProperties = schema.MinProperties
	typeDef.MaxProperties = schema.MaxProperties

	// Items for arrays
	if schema.Items != nil {
		typeDef.Items = c.convertSchema(schema.Items)
	}

	// Properties for objects
	if schema.Properties != nil {
		typeDef.Properties = make(map[string]*parser.TypeDefinition)
		for propName, propSchema := range schema.Properties {
			typeDef.Properties[propName] = c.convertSchema(propSchema)
		}
	}

	// Required properties
	typeDef.Required = schema.Required

	// OneOf/AnyOf/AllOf
	if schema.OneOf != nil {
		for _, s := range schema.OneOf {
			typeDef.OneOf = append(typeDef.OneOf, c.convertSchema(s))
		}
	}
	if schema.AnyOf != nil {
		for _, s := range schema.AnyOf {
			typeDef.AnyOf = append(typeDef.AnyOf, c.convertSchema(s))
		}
	}
	if schema.AllOf != nil {
		for _, s := range schema.AllOf {
			typeDef.AllOf = append(typeDef.AllOf, c.convertSchema(s))
		}
	}

	return typeDef
}

// convertTypes converts OpenAPI component schemas to IR types
func (c *OpenAPIToIRConverter) convertTypes(spec *parser.ParsedSpec) []parser.TypeDefinition {
	var types []parser.TypeDefinition

	if spec.Components == nil || spec.Components.Schemas == nil {
		return types
	}

	for name, schema := range spec.Components.Schemas {
		typeDef := c.convertSchema(schema)
		if typeDef != nil {
			typeDef.Name = name
			types = append(types, *typeDef)
		}
	}

	return types
}

// convertAuth converts OpenAPI security schemes to IR auth schemes
func (c *OpenAPIToIRConverter) convertAuth(spec *parser.ParsedSpec) []parser.AuthScheme {
	var authSchemes []parser.AuthScheme

	if spec.Components == nil || spec.Components.SecuritySchemes == nil {
		return authSchemes
	}

	for id, secScheme := range spec.Components.SecuritySchemes {
		authScheme := parser.AuthScheme{
			ID:          id,
			Type:        secScheme.Type,
			Description: secScheme.Description,
		}

		switch secScheme.Type {
		case "apiKey":
			authScheme.APIKey = &parser.APIKeyAuth{
				Name: secScheme.Name,
				In:   secScheme.In,
			}

		case "http":
			authScheme.HTTP = &parser.HTTPAuth{
				Scheme:       secScheme.Scheme,
				BearerFormat: secScheme.BearerFormat,
			}

		case "oauth2":
			if secScheme.Flows != nil {
				authScheme.OAuth2 = &parser.OAuth2Auth{
					Flows: c.convertOAuth2Flows(secScheme.Flows),
				}
			}

		case "openIdConnect":
			authScheme.OpenIDConnect = &parser.OpenIDConnectAuth{
				OpenIDConnectURL: secScheme.OpenIDConnectUrl,
			}
		}

		authSchemes = append(authSchemes, authScheme)
	}

	return authSchemes
}

// convertOAuth2Flows converts OpenAPI OAuth2 flows to IR OAuth2 flows
func (c *OpenAPIToIRConverter) convertOAuth2Flows(flows *parser.OAuthFlows) parser.OAuth2Flows {
	irFlows := parser.OAuth2Flows{}

	if flows.Implicit != nil {
		irFlows.Implicit = &parser.OAuth2Flow{
			AuthorizationURL: flows.Implicit.AuthorizationURL,
			TokenURL:         flows.Implicit.TokenURL,
			RefreshURL:       flows.Implicit.RefreshURL,
			Scopes:           flows.Implicit.Scopes,
		}
	}

	if flows.Password != nil {
		irFlows.Password = &parser.OAuth2Flow{
			AuthorizationURL: flows.Password.AuthorizationURL,
			TokenURL:         flows.Password.TokenURL,
			RefreshURL:       flows.Password.RefreshURL,
			Scopes:           flows.Password.Scopes,
		}
	}

	if flows.ClientCredentials != nil {
		irFlows.ClientCredentials = &parser.OAuth2Flow{
			AuthorizationURL: flows.ClientCredentials.AuthorizationURL,
			TokenURL:         flows.ClientCredentials.TokenURL,
			RefreshURL:       flows.ClientCredentials.RefreshURL,
			Scopes:           flows.ClientCredentials.Scopes,
		}
	}

	if flows.AuthorizationCode != nil {
		irFlows.AuthorizationCode = &parser.OAuth2Flow{
			AuthorizationURL: flows.AuthorizationCode.AuthorizationURL,
			TokenURL:         flows.AuthorizationCode.TokenURL,
			RefreshURL:       flows.AuthorizationCode.RefreshURL,
			Scopes:           flows.AuthorizationCode.Scopes,
		}
	}

	return irFlows
}

// convertServers converts OpenAPI servers to IR server configs
func (c *OpenAPIToIRConverter) convertServers(spec *parser.ParsedSpec) []parser.ServerConfig {
	var servers []parser.ServerConfig

	for _, server := range spec.Servers {
		serverConfig := parser.ServerConfig{
			URL:         server.URL,
			Description: server.Description,
			Protocol:    c.detectProtocol(server.URL),
			Variables:   make(map[string]parser.ServerVariable),
		}

		for varName, varValue := range server.Variables {
			serverConfig.Variables[varName] = parser.ServerVariable{
				Default:     varValue,
				Description: "",
			}
		}

		servers = append(servers, serverConfig)
	}

	return servers
}

// convertGlobals converts OpenAPI global settings to IR globals
func (c *OpenAPIToIRConverter) convertGlobals(spec *parser.ParsedSpec) parser.GlobalConfig {
	return parser.GlobalConfig{
		Headers:    make(map[string]string),
		Parameters: []parser.Parameter{},
	}
}

// Helper functions

func (c *OpenAPIToIRConverter) generateEndpointName(op *parser.Operation, method, path string) string {
	if op.ID != "" {
		return op.ID
	}
	if op.Summary != "" {
		return op.Summary
	}
	return fmt.Sprintf("%s %s", method, path)
}

func (c *OpenAPIToIRConverter) getOperationDescription(op *parser.Operation) string {
	if op.Description != "" {
		return op.Description
	}
	return op.Summary
}

func (c *OpenAPIToIRConverter) extractAuthReferences(security []parser.SecurityRequirement) []string {
	var refs []string
	for _, sec := range security {
		for name := range sec {
			refs = append(refs, name)
		}
	}
	return refs
}

func (c *OpenAPIToIRConverter) detectOpenAPIVersion(spec *parser.ParsedSpec) string {
	// This would need to be passed from the original spec
	// For now, default to 3.0.0
	return "3.0.0"
}

func (c *OpenAPIToIRConverter) detectProtocol(url string) string {
	if len(url) > 0 {
		if url[:7] == "http://" {
			return "http"
		}
		if url[:8] == "https://" {
			return "https"
		}
		if url[:5] == "ws://" {
			return "ws"
		}
		if url[:6] == "wss://" {
			return "wss"
		}
	}
	return "https"
}

func (c *OpenAPIToIRConverter) convertExamples(examples map[string]parser.Example) map[string]parser.Example {
	irExamples := make(map[string]parser.Example)
	for name, example := range examples {
		irExamples[name] = parser.Example{
			Summary:       example.Summary,
			Description:   example.Description,
			Value:         example.Value,
			ExternalValue: example.ExternalValue,
		}
	}
	return irExamples
}
