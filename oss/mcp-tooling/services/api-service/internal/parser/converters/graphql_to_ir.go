package converters

import (
	"fmt"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// GraphQLToIRConverter converts GraphQL schema to Intermediate Representation
type GraphQLToIRConverter struct {
	version string
}

// NewGraphQLToIRConverter creates a new GraphQL to IR converter
func NewGraphQLToIRConverter() *GraphQLToIRConverter {
	return &GraphQLToIRConverter{
		version: "1.0.0",
	}
}

// Convert converts a GraphQL schema to IntermediateRepresentation
func (c *GraphQLToIRConverter) Convert(schema *parser.GraphQLSchema) (*parser.IntermediateRepresentation, error) {
	if schema == nil {
		return nil, fmt.Errorf("schema cannot be nil")
	}

	ir := &parser.IntermediateRepresentation{
		Metadata:   c.convertMetadata(schema),
		Endpoints:  c.convertEndpoints(schema),
		Types:      c.convertTypes(schema),
		Auth:       []parser.AuthScheme{}, // GraphQL typically uses HTTP headers
		Servers:    []parser.ServerConfig{},
		Globals:    parser.GlobalConfig{},
		Extensions: make(map[string]interface{}),
		Source: parser.SourceInfo{
			Format:        "graphql",
			Version:       "SDL",
			ParserVersion: c.version,
			ParsedAt:      time.Now(),
		},
	}

	return ir, nil
}

// convertMetadata converts GraphQL schema info to IR metadata
func (c *GraphQLToIRConverter) convertMetadata(schema *parser.GraphQLSchema) parser.APIMetadata {
	return parser.APIMetadata{
		Name:        schema.Info.Title,
		Title:       schema.Info.Title,
		Description: schema.Info.Description,
		Version:     schema.Info.Version,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

// convertEndpoints converts GraphQL operations to IR endpoints
func (c *GraphQLToIRConverter) convertEndpoints(schema *parser.GraphQLSchema) []parser.UnifiedEndpoint {
	var endpoints []parser.UnifiedEndpoint

	// Convert queries
	for _, query := range schema.Queries {
		endpoint := c.convertOperation(query, "query")
		endpoints = append(endpoints, endpoint)
	}

	// Convert mutations
	for _, mutation := range schema.Mutations {
		endpoint := c.convertOperation(mutation, "mutation")
		endpoints = append(endpoints, endpoint)
	}

	// Convert subscriptions
	for _, subscription := range schema.Subscriptions {
		endpoint := c.convertOperation(subscription, "subscription")
		endpoint.Streaming = &parser.StreamingInfo{
			Type: "server-stream",
			Settings: map[string]interface{}{
				"protocol": "graphql-ws",
			},
		}
		endpoints = append(endpoints, endpoint)
	}

	return endpoints
}

// convertOperation converts a GraphQL operation to IR endpoint
func (c *GraphQLToIRConverter) convertOperation(op parser.GraphQLOperation, opType string) parser.UnifiedEndpoint {
	return parser.UnifiedEndpoint{
		ID:          op.Name,
		Name:        op.Name,
		Description: op.Description,
		Method:      "POST",
		Path:        "/graphql",
		Parameters:  c.convertArguments(op.Arguments),
		RequestBody: c.createGraphQLRequestBody(op, opType),
		Responses: map[string]parser.ResponseSchema{
			"200": c.createGraphQLResponse(op),
		},
		Tags:       []string{opType},
		Extensions: make(map[string]interface{}),
	}
}

// convertArguments converts GraphQL arguments to IR parameters
func (c *GraphQLToIRConverter) convertArguments(args []parser.GraphQLArgument) []parser.Parameter {
	var params []parser.Parameter

	for _, arg := range args {
		param := parser.Parameter{
			Name:        arg.Name,
			In:          "body",
			Description: arg.Description,
			Required:    arg.Required,
			Schema: &parser.TypeDefinition{
				Type:        c.mapGraphQLTypeToJSONType(arg.Type),
				Description: arg.Description,
				Default:     arg.Default,
			},
		}
		params = append(params, param)
	}

	return params
}

// createGraphQLRequestBody creates a request body for GraphQL operation
func (c *GraphQLToIRConverter) createGraphQLRequestBody(op parser.GraphQLOperation, opType string) *parser.RequestBodySchema {
	properties := make(map[string]*parser.TypeDefinition)

	properties["query"] = &parser.TypeDefinition{
		Type:        "string",
		Description: fmt.Sprintf("GraphQL %s query", opType),
	}

	if len(op.Variables) > 0 {
		properties["variables"] = &parser.TypeDefinition{
			Type:        "object",
			Description: "GraphQL variables",
			Properties:  c.convertVariablesToProperties(op.Variables),
		}
	}

	properties["operationName"] = &parser.TypeDefinition{
		Type:        "string",
		Description: "Operation name",
	}

	return &parser.RequestBodySchema{
		Description: fmt.Sprintf("GraphQL %s request", opType),
		Required:    true,
		Content: map[string]parser.MediaTypeSchema{
			"application/json": {
				Schema: &parser.TypeDefinition{
					Type:       "object",
					Properties: properties,
					Required:   []string{"query"},
				},
			},
		},
	}
}

// createGraphQLResponse creates a response schema for GraphQL operation
func (c *GraphQLToIRConverter) createGraphQLResponse(op parser.GraphQLOperation) parser.ResponseSchema {
	return parser.ResponseSchema{
		Description: "GraphQL response",
		Content: map[string]parser.MediaTypeSchema{
			"application/json": {
				Schema: &parser.TypeDefinition{
					Type: "object",
					Properties: map[string]*parser.TypeDefinition{
						"data": {
							Type:        "object",
							Description: "Query results",
						},
						"errors": {
							Type:        "array",
							Description: "GraphQL errors",
							Items: &parser.TypeDefinition{
								Type: "object",
								Properties: map[string]*parser.TypeDefinition{
									"message": {Type: "string"},
									"locations": {
										Type: "array",
										Items: &parser.TypeDefinition{
											Type: "object",
										},
									},
									"path": {
										Type: "array",
										Items: &parser.TypeDefinition{
											Type: "string",
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// convertTypes converts GraphQL types to IR type definitions
func (c *GraphQLToIRConverter) convertTypes(schema *parser.GraphQLSchema) []parser.TypeDefinition {
	var types []parser.TypeDefinition

	for _, gqlType := range schema.Types {
		if gqlType.IsBuiltIn {
			continue
		}

		typeDef := parser.TypeDefinition{
			Name:        gqlType.Name,
			Type:        c.mapGraphQLKindToJSONType(gqlType.Kind),
			Description: gqlType.Description,
			Extensions:  make(map[string]interface{}),
		}

		// Convert fields to properties for OBJECT types
		if gqlType.Kind == "OBJECT" && len(gqlType.Fields) > 0 {
			typeDef.Properties = make(map[string]*parser.TypeDefinition)
			for _, field := range gqlType.Fields {
				typeDef.Properties[field.Name] = &parser.TypeDefinition{
					Type:        c.mapGraphQLFieldTypeToJSONType(field.Type),
					Description: field.Description,
				}
			}
		}

		// Convert enum values
		if gqlType.Kind == "ENUM" && len(gqlType.Enums) > 0 {
			for _, enumVal := range gqlType.Enums {
				typeDef.Enum = append(typeDef.Enum, enumVal.Name)
			}
		}

		types = append(types, typeDef)
	}

	return types
}

// Helper functions

func (c *GraphQLToIRConverter) convertVariablesToProperties(variables []parser.GraphQLVariable) map[string]*parser.TypeDefinition {
	properties := make(map[string]*parser.TypeDefinition)

	for _, variable := range variables {
		properties[variable.Name] = &parser.TypeDefinition{
			Type:        c.mapGraphQLFieldTypeToJSONType(variable.Type),
			Description: variable.Description,
			Default:     variable.Default,
		}
	}

	return properties
}

func (c *GraphQLToIRConverter) mapGraphQLTypeToJSONType(graphQLType string) string {
	switch graphQLType {
	case "integer", "Int":
		return "integer"
	case "number", "Float":
		return "number"
	case "boolean", "Boolean":
		return "boolean"
	case "array":
		return "array"
	default:
		return "string"
	}
}

func (c *GraphQLToIRConverter) mapGraphQLKindToJSONType(kind string) string {
	switch kind {
	case "OBJECT", "INTERFACE", "UNION":
		return "object"
	case "INPUT_OBJECT":
		return "object"
	case "SCALAR":
		return "string"
	case "ENUM":
		return "string"
	case "LIST":
		return "array"
	default:
		return "string"
	}
}

func (c *GraphQLToIRConverter) mapGraphQLFieldTypeToJSONType(fieldType parser.GraphQLFieldType) string {
	switch fieldType.Kind {
	case "NON_NULL":
		if fieldType.OfType != nil {
			return c.mapGraphQLFieldTypeToJSONType(*fieldType.OfType)
		}
		return "string"
	case "LIST":
		return "array"
	case "NAMED":
		return c.mapScalarType(fieldType.Name)
	default:
		return "string"
	}
}

func (c *GraphQLToIRConverter) mapScalarType(typeName string) string {
	switch typeName {
	case "Int", "BigInt":
		return "integer"
	case "Float", "BigDecimal":
		return "number"
	case "Boolean":
		return "boolean"
	case "ID", "String", "DateTime", "Date", "Time":
		return "string"
	default:
		return "object"
	}
}
