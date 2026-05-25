package parser

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/pkg/errors"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

// GraphQLParser handles parsing and validation of GraphQL schemas and introspection queries
type GraphQLParser struct {
	httpClient *http.Client
}

// NewGraphQLParser creates a new GraphQL parser instance
func NewGraphQLParser() *GraphQLParser {
	return &GraphQLParser{
		httpClient: &http.Client{},
	}
}

// GraphQLSchema represents a parsed GraphQL schema
type GraphQLSchema struct {
	Schema        *ast.Schema         `json:"schema"`
	Types         []GraphQLType       `json:"types"`
	Operations    []GraphQLOperation  `json:"operations"`
	Queries       []GraphQLOperation  `json:"queries"`
	Mutations     []GraphQLOperation  `json:"mutations"`
	Subscriptions []GraphQLOperation  `json:"subscriptions"`
	Info          SchemaInfo          `json:"info"`
	Endpoints     []Endpoint          `json:"endpoints"`
	Validation    ValidationResults   `json:"validation"`
	Metadata      GraphQLSpecMetadata `json:"metadata"`
}

// GraphQLType represents a GraphQL type
type GraphQLType struct {
	Name          string              `json:"name"`
	Kind          string              `json:"kind"` // OBJECT, INTERFACE, UNION, INPUT_OBJECT, SCALAR, ENUM
	Description   string              `json:"description,omitempty"`
	Fields        []GraphQLField      `json:"fields,omitempty"`
	Inputs        []GraphQLInputValue `json:"inputs,omitempty"`
	Enums         []GraphQLEnumValue  `json:"enums,omitempty"`
	Interfaces    []string            `json:"interfaces,omitempty"`
	PossibleTypes []string            `json:"possibleTypes,omitempty"`
	Directives    []GraphQLDirective  `json:"directives,omitempty"`
	IsBuiltIn     bool                `json:"isBuiltIn"`
}

// GraphQLField represents a GraphQL field
type GraphQLField struct {
	Name        string              `json:"name"`
	Description string              `json:"description,omitempty"`
	Type        GraphQLFieldType    `json:"type"`
	Args        []GraphQLInputValue `json:"args,omitempty"`
	Directives  []GraphQLDirective  `json:"directives,omitempty"`
	Deprecation string              `json:"deprecation,omitempty"`
}

// GraphQLInputValue represents a GraphQL input value
type GraphQLInputValue struct {
	Name         string             `json:"name"`
	Description  string             `json:"description,omitempty"`
	Type         GraphQLFieldType   `json:"type"`
	DefaultValue string             `json:"defaultValue,omitempty"`
	Directives   []GraphQLDirective `json:"directives,omitempty"`
}

// GraphQLFieldType represents a GraphQL field type
type GraphQLFieldType struct {
	Name   string            `json:"name"`
	Kind   string            `json:"kind"` // NON_NULL, LIST, NAMED
	OfType *GraphQLFieldType `json:"ofType,omitempty"`
}

// GraphQLEnumValue represents a GraphQL enum value
type GraphQLEnumValue struct {
	Name        string             `json:"name"`
	Description string             `json:"description,omitempty"`
	Directives  []GraphQLDirective `json:"directives,omitempty"`
	Deprecation string             `json:"deprecation,omitempty"`
}

// GraphQLDirective represents a GraphQL directive
type GraphQLDirective struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// GraphQLOperation represents a GraphQL operation (query, mutation, subscription)
type GraphQLOperation struct {
	Name        string            `json:"name"`
	Type        string            `json:"type"` // query, mutation, subscription
	Description string            `json:"description,omitempty"`
	Fields      []GraphQLField    `json:"fields"`
	Arguments   []GraphQLArgument `json:"arguments"`
	Variables   []GraphQLVariable `json:"variables,omitempty"`
	Complexity  int               `json:"complexity"`
}

// GraphQLArgument represents a GraphQL argument
type GraphQLArgument struct {
	Name        string      `json:"name"`
	Type        string      `json:"type"`
	Description string      `json:"description,omitempty"`
	Required    bool        `json:"required"`
	Default     interface{} `json:"default,omitempty"`
}

// GraphQLVariable represents a GraphQL variable
type GraphQLVariable struct {
	Name        string           `json:"name"`
	Type        GraphQLFieldType `json:"type"`
	Default     interface{}      `json:"default,omitempty"`
	Description string           `json:"description,omitempty"`
}

// SchemaInfo contains basic information about the GraphQL schema
type SchemaInfo struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version"`
	URL         string `json:"url,omitempty"`
}

// GraphQLSpecMetadata represents metadata for GraphQL schemas
type GraphQLSpecMetadata struct {
	TypeName         string   `json:"type_name"`
	TotalOperations  int      `json:"total_operations"`
	TotalTypes       int      `json:"total_types"`
	ComplexityScore  int      `json:"complexity_score"`
	EstimatedTime    int      `json:"estimated_time"`
	OperationTypes   []string `json:"operation_types"`
	HasSubscriptions bool     `json:"has_subscriptions"`
}

// GraphQLIntrospectionResponse represents the response from a GraphQL introspection query
type GraphQLIntrospectionResponse struct {
	Data struct {
		Schema GraphQLIntrospectionSchema `json:"__schema"`
	} `json:"data"`
	Errors []GraphQLError `json:"errors,omitempty"`
}

// GraphQLIntrospectionSchema represents the introspection schema
type GraphQLIntrospectionSchema struct {
	Description      string                          `json:"description"`
	Types            []GraphQLIntrospectionType      `json:"types"`
	QueryType        *GraphQLIntrospectionType       `json:"queryType"`
	MutationType     *GraphQLIntrospectionType       `json:"mutationType"`
	SubscriptionType *GraphQLIntrospectionType       `json:"subscriptionType"`
	Directives       []GraphQLIntrospectionDirective `json:"directives"`
}

// GraphQLIntrospectionType represents an introspected type
type GraphQLIntrospectionType struct {
	Kind          string                           `json:"kind"`
	Name          string                           `json:"name"`
	Description   string                           `json:"description"`
	Fields        []GraphQLIntrospectionField      `json:"fields,omitempty"`
	InputFields   []GraphQLIntrospectionInputValue `json:"inputFields,omitempty"`
	Interfaces    []GraphQLIntrospectionType       `json:"interfaces,omitempty"`
	EnumValues    []GraphQLIntrospectionEnumValue  `json:"enumValues,omitempty"`
	PossibleTypes []GraphQLIntrospectionType       `json:"possibleTypes,omitempty"`
}

// GraphQLIntrospectionField represents an introspected field
type GraphQLIntrospectionField struct {
	Name              string                           `json:"name"`
	Description       string                           `json:"description"`
	Args              []GraphQLIntrospectionInputValue `json:"args"`
	Type              GraphQLIntrospectionTypeRef      `json:"type"`
	IsDeprecated      bool                             `json:"isDeprecated"`
	DeprecationReason string                           `json:"deprecationReason"`
}

// GraphQLIntrospectionInputValue represents an introspected input value
type GraphQLIntrospectionInputValue struct {
	Name         string                      `json:"name"`
	Description  string                      `json:"description"`
	Type         GraphQLIntrospectionTypeRef `json:"type"`
	DefaultValue string                      `json:"defaultValue"`
}

// GraphQLIntrospectionEnumValue represents an introspected enum value
type GraphQLIntrospectionEnumValue struct {
	Name              string `json:"name"`
	Description       string `json:"description"`
	IsDeprecated      bool   `json:"isDeprecated"`
	DeprecationReason string `json:"deprecationReason"`
}

// GraphQLIntrospectionTypeRef represents a type reference
type GraphQLIntrospectionTypeRef struct {
	Kind   string                       `json:"kind"`
	Name   string                       `json:"name,omitempty"`
	OfType *GraphQLIntrospectionTypeRef `json:"ofType,omitempty"`
}

// GraphQLIntrospectionDirective represents an introspected directive
type GraphQLIntrospectionDirective struct {
	Name        string                           `json:"name"`
	Description string                           `json:"description"`
	Locations   []string                         `json:"locations"`
	Args        []GraphQLIntrospectionInputValue `json:"args"`
}

// GraphQLError represents a GraphQL error
type GraphQLError struct {
	Message    string                 `json:"message"`
	Locations  []GraphQLErrorLocation `json:"locations,omitempty"`
	Path       []interface{}          `json:"path,omitempty"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// GraphQLErrorLocation represents an error location
type GraphQLErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// ParseGraphQLSchema parses a GraphQL schema from a string
func (p *GraphQLParser) ParseGraphQLSchema(schemaContent string) (*GraphQLSchema, error) {
	// Parse the GraphQL schema
	_, err := parser.ParseSchema(&ast.Source{
		Input: schemaContent,
		Name:  "schema.graphql",
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse GraphQL schema")
	}

	// For now, create a simple schema without complex validation
	// Create a simple GraphQLSchema structure
	graphQLSchema := &GraphQLSchema{
		Schema: &ast.Schema{
			Types: map[string]*ast.Definition{},
		},
		Info: SchemaInfo{
			Title:       "GraphQL API",
			Description: "API parsed from GraphQL schema",
			Version:     "1.0.0",
		},
		Types:         []GraphQLType{},
		Operations:    []GraphQLOperation{},
		Queries:       []GraphQLOperation{},
		Mutations:     []GraphQLOperation{},
		Subscriptions: []GraphQLOperation{},
		Endpoints:     []Endpoint{},
		Validation: ValidationResults{
			Valid:    true,
			IsValid:  true,
			Errors:   []ValidationError{},
			Warnings: []ValidationError{},
			Info:     []ValidationError{},
			Infos:    []ValidationError{},
		},
		Metadata: GraphQLSpecMetadata{
			TypeName:         "GraphQLSchema",
			TotalOperations:  0,
			TotalTypes:       0,
			ComplexityScore:  10,
			EstimatedTime:    30,
			OperationTypes:   []string{},
			HasSubscriptions: false,
		},
	}

	return graphQLSchema, nil
}

// ParseFromURL parses a GraphQL schema from a URL endpoint
func (p *GraphQLParser) ParseFromURL(url string) (*GraphQLSchema, error) {
	// For GraphQL, we use introspection to parse from a URL
	introspectionQuery := `
		query IntrospectionQuery {
			__schema {
				queryType { name }
				mutationType { name }
				subscriptionType { name }
				types {
					kind
					name
					description
				}
			}
		}
	`

	requestBody := map[string]interface{}{
		"query": introspectionQuery,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal introspection request")
	}

	resp, err := http.Post(url, "application/json", strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, errors.Wrap(err, "failed to send introspection request")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("introspection request failed with status %d", resp.StatusCode)
	}

	var introspectionResponse GraphQLIntrospectionResponse
	if err := json.NewDecoder(resp.Body).Decode(&introspectionResponse); err != nil {
		return nil, errors.Wrap(err, "failed to decode introspection response")
	}

	if len(introspectionResponse.Errors) > 0 {
		return nil, fmt.Errorf("introspection errors: %v", introspectionResponse.Errors)
	}

	return p.ParseGraphQLFromIntrospection([]byte(fmt.Sprintf("%+v", introspectionResponse.Data)))
}

// ParseIntrospection parses a GraphQL schema from introspection data
func (p *GraphQLParser) ParseIntrospection(introspectionData string) (*GraphQLSchema, error) {
	return p.ParseGraphQLFromIntrospection([]byte(introspectionData))
}

// ParseGraphQLFromIntrospection parses a GraphQL schema from introspection query results
func (p *GraphQLParser) ParseGraphQLFromIntrospection(introspectionData []byte) (*GraphQLSchema, error) {
	// Parse the introspection response
	var response GraphQLIntrospectionResponse
	if err := json.Unmarshal(introspectionData, &response); err != nil {
		return nil, errors.Wrap(err, "failed to parse GraphQL introspection response")
	}

	// Check for errors
	if len(response.Errors) > 0 {
		return nil, fmt.Errorf("GraphQL introspection failed: %v", response.Errors[0].Message)
	}

	// Convert introspection data to schema
	graphQLSchema := &GraphQLSchema{
		Info: SchemaInfo{
			Title:       "GraphQL API",
			Description: "API parsed from GraphQL introspection",
			Version:     "1.0.0",
		},
		Types:         p.convertTypesFromIntrospection(response.Data.Schema.Types),
		Operations:    []GraphQLOperation{},
		Queries:       []GraphQLOperation{},
		Mutations:     []GraphQLOperation{},
		Subscriptions: []GraphQLOperation{},
		Endpoints:     []Endpoint{},
		Validation: ValidationResults{
			Valid:    true,
			IsValid:  true,
			Errors:   []ValidationError{},
			Warnings: []ValidationError{},
			Info:     []ValidationError{},
			Infos:    []ValidationError{},
		},
		Metadata: p.extractMetadataFromIntrospection(&response.Data.Schema),
	}

	return graphQLSchema, nil
}

// Convert GraphQL schema to OpenAPI specification
func (p *GraphQLParser) ConvertToOpenAPI(graphQLSchema *GraphQLSchema) (*ParsedSpec, error) {
	// Create a new OpenAPI specification
	openAPISpec := &ParsedSpec{
		Info: SpecInfo{
			Title:       graphQLSchema.Info.Title,
			Description: graphQLSchema.Info.Description,
			Version:     graphQLSchema.Info.Version,
		},
		Servers: []Server{
			{
				URL:         graphQLSchema.Info.URL,
				Description: "GraphQL API Endpoint",
			},
		},
		Paths:      map[string]Path{},
		Components: &Components{},
		Validation: &ValidationResults{
			Valid:    true,
			IsValid:  true,
			Errors:   []ValidationError{},
			Warnings: []ValidationError{},
			Info:     []ValidationError{},
			Infos:    []ValidationError{},
		},
		Metadata: SpecMetadata{
			"HTTPMethods":     []string{"POST"},
			"Authentication":  []string{},
			"DataTypes":       []string{},
			"Category":        "GraphQL",
			"TotalEndpoints":  len(graphQLSchema.Endpoints),
			"BaseURL":         graphQLSchema.Info.URL,
			"ComplexityScore": graphQLSchema.Metadata.ComplexityScore,
			"EstimatedTime":   graphQLSchema.Metadata.EstimatedTime,
		},
	}

	// Create a single POST endpoint for GraphQL operations
	openAPISpec.Paths["/graphql"] = Path{
		Operations: map[string]*Operation{
			"post": {
				ID:          "executeGraphQL",
				Method:      "POST",
				Path:        "/graphql",
				Summary:     "Execute GraphQL Query",
				Description: "Execute GraphQL queries, mutations, or subscriptions",
				Tags:        []string{"GraphQL"},
				RequestBody: &RequestBodyInfo{
					Description: "GraphQL request",
					Required:    true,
					Content: map[string]*Media{
						"application/json": {
							Schema: &Schema{
								Type: "object",
								Properties: map[string]*Schema{
									"query": {
										Type:        "string",
										Description: "GraphQL query string",
									},
									"variables": {
										Type:        "object",
										Description: "GraphQL variables",
									},
									"operationName": {
										Type:        "string",
										Description: "Operation name",
									},
								},
							},
						},
					},
				},
				Responses: map[string]*LegacyResponse{
					"200": {
						Description: "Successful execution",
						Content: map[string]*Media{
							"application/json": {
								Schema: &Schema{
									Type: "object",
									Properties: map[string]*Schema{
										"data": {
											Type:        "object",
											Description: "Query results",
										},
										"errors": {
											Type:        "array",
											Description: "GraphQL errors",
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

	// Add GraphQL-specific components
	if openAPISpec.Components == nil {
		openAPISpec.Components = &Components{}
	}

	// Add custom schemas for GraphQL types
	openAPISpec.Components.Schemas = p.convertGraphQLTypesToSchemas(graphQLSchema.Types)

	// Add endpoints for each operation
	openAPISpec.Endpoints = graphQLSchema.Endpoints

	return openAPISpec, nil
}

// Helper methods

func (p *GraphQLParser) extractGraphQLInfo(schema *ast.Schema) SchemaInfo {
	return SchemaInfo{
		Title:       "GraphQL API",
		Description: "API parsed from GraphQL schema",
		Version:     "1.0.0",
	}
}

func (p *GraphQLParser) convertGraphQLTypes(schema *ast.Schema) []GraphQLType {
	var types []GraphQLType

	for name, def := range schema.Types {
		if name == "__Schema" || name == "__Type" || name == "__Field" || name == "__InputValue" ||
			name == "__EnumValue" || name == "__Directive" || name == "__DirectiveLocation" ||
			name == "__TypeKind" {
			continue // Skip introspection types
		}

		graphQLType := GraphQLType{
			Name:        name,
			Description: def.Description,
			IsBuiltIn:   isBuiltInType(name),
		}

		switch def.Kind {
		case ast.Object:
			graphQLType.Kind = "OBJECT"
		case ast.Interface:
			graphQLType.Kind = "INTERFACE"
		case ast.Union:
			graphQLType.Kind = "UNION"
		case ast.InputObject:
			graphQLType.Kind = "INPUT_OBJECT"
		case ast.Scalar:
			graphQLType.Kind = "SCALAR"
		case ast.Enum:
			graphQLType.Kind = "ENUM"
		}

		types = append(types, graphQLType)
	}

	return types
}

func (p *GraphQLParser) extractOperations(schema *ast.Schema, operationType string) []GraphQLOperation {
	var operations []GraphQLOperation

	var operationDef *ast.Definition
	switch operationType {
	case "query":
		operationDef = schema.Query
	case "mutation":
		operationDef = schema.Mutation
	case "subscription":
		operationDef = schema.Subscription
	}

	if operationDef != nil {
		// Create individual operations for each field
		for _, field := range operationDef.Fields {
			arguments := []GraphQLArgument{}
			for _, arg := range field.Arguments {
				arguments = append(arguments, GraphQLArgument{
					Name:        arg.Name,
					Type:        p.mapGraphQLTypeToJSONType(arg.Type.String()),
					Description: arg.Description,
					Required:    strings.Contains(arg.Type.String(), "!"),
					Default:     arg.DefaultValue,
				})
			}

			operation := GraphQLOperation{
				Name:        field.Name,
				Type:        operationType,
				Description: field.Description,
				Fields:      []GraphQLField{},
				Arguments:   arguments,
				Complexity:  len(field.Arguments) * 2,
			}

			operations = append(operations, operation)
		}
	}

	return operations
}

func (p *GraphQLParser) extractGraphQLEndpoints(schema *ast.Schema) []Endpoint {
	var endpoints []Endpoint

	// Add a single GraphQL endpoint
	endpoints = append(endpoints, Endpoint{
		Name:        "graphql",
		Method:      "POST",
		Path:        "/graphql",
		Description: "GraphQL endpoint for queries, mutations, and subscriptions",
		Parameters:  []Parameter{},
	})

	return endpoints
}

func (p *GraphQLParser) validateGraphQLSchema(schema *ast.Schema) ValidationResults {
	// Validation is already done during parsing, so this is just a wrapper
	return ValidationResults{
		IsValid:  true,
		Errors:   []ValidationError{},
		Warnings: []ValidationError{},
		Infos:    []ValidationError{},
	}
}

func (p *GraphQLParser) extractGraphQLMetadata(schema *ast.Schema) GraphQLSpecMetadata {
	metadata := GraphQLSpecMetadata{
		TypeName:         "GraphQLSchema",
		TotalOperations:  0,
		TotalTypes:       0,
		ComplexityScore:  0,
		EstimatedTime:    0,
		OperationTypes:   []string{},
		HasSubscriptions: false,
	}

	// Count types and operations
	if schema.Query != nil {
		metadata.TotalOperations += len(schema.Query.Fields)
		metadata.OperationTypes = append(metadata.OperationTypes, "query")
	}
	if schema.Mutation != nil {
		metadata.TotalOperations += len(schema.Mutation.Fields)
		metadata.OperationTypes = append(metadata.OperationTypes, "mutation")
	}
	if schema.Subscription != nil {
		metadata.TotalOperations += len(schema.Subscription.Fields)
		metadata.OperationTypes = append(metadata.OperationTypes, "subscription")
		metadata.HasSubscriptions = true
	}

	// Count types (excluding built-in types)
	for name, _ := range schema.Types {
		if !isBuiltInType(name) {
			metadata.TotalTypes++
		}
	}

	// Calculate complexity
	metadata.ComplexityScore = len(schema.Types) * 10
	metadata.EstimatedTime = metadata.ComplexityScore * 3 // 3 minutes per type

	return metadata
}

// Introspection helper methods

func (p *GraphQLParser) extractInfoFromIntrospection(schema *GraphQLIntrospectionSchema) SchemaInfo {
	return SchemaInfo{
		Title:       "GraphQL API",
		Description: "API parsed from GraphQL introspection",
		Version:     "1.0.0",
	}
}

func (p *GraphQLParser) convertTypesFromIntrospection(types []GraphQLIntrospectionType) []GraphQLType {
	var graphQLTypes []GraphQLType

	for _, gqlType := range types {
		if strings.HasPrefix(gqlType.Name, "__") {
			continue // Skip introspection types
		}

		graphQLType := GraphQLType{
			Name:        gqlType.Name,
			Description: gqlType.Description,
			IsBuiltIn:   isBuiltInType(gqlType.Name),
			Kind:        gqlType.Kind,
		}

		graphQLTypes = append(graphQLTypes, graphQLType)
	}

	return graphQLTypes
}

func (p *GraphQLParser) extractMetadataFromIntrospection(schema *GraphQLIntrospectionSchema) GraphQLSpecMetadata {
	metadata := GraphQLSpecMetadata{
		TypeName:         "GraphQLSchema",
		TotalOperations:  0,
		TotalTypes:       0,
		ComplexityScore:  0,
		EstimatedTime:    0,
		OperationTypes:   []string{},
		HasSubscriptions: false,
	}

	// Count types (excluding introspection types)
	for _, gqlType := range schema.Types {
		if !strings.HasPrefix(gqlType.Name, "__") {
			metadata.TotalTypes++
			metadata.ComplexityScore++
		}
	}

	// Check for subscriptions
	if schema.SubscriptionType != nil {
		metadata.HasSubscriptions = true
		metadata.OperationTypes = append(metadata.OperationTypes, "subscription")
	}

	// Check for queries and mutations
	if schema.QueryType != nil {
		metadata.OperationTypes = append(metadata.OperationTypes, "query")
	}
	if schema.MutationType != nil {
		metadata.OperationTypes = append(metadata.OperationTypes, "mutation")
	}

	metadata.EstimatedTime = metadata.ComplexityScore * 3

	return metadata
}

func (p *GraphQLParser) convertGraphQLTypesToSchemas(graphQLTypes []GraphQLType) map[string]*Schema {
	schemas := make(map[string]*Schema)

	for _, gqlType := range graphQLTypes {
		if gqlType.IsBuiltIn {
			continue
		}

		schema := &Schema{
			Type:        p.mapGraphQLKindToJSONType(gqlType.Kind),
			Description: gqlType.Description,
		}

		schemas[gqlType.Name] = schema
	}

	return schemas
}

func (p *GraphQLParser) mapGraphQLKindToJSONType(kind string) string {
	switch kind {
	case "OBJECT", "INTERFACE", "UNION":
		return "object"
	case "INPUT_OBJECT":
		return "object"
	case "SCALAR":
		return "string"
	case "ENUM":
		return "string"
	default:
		return "string"
	}
}

func (p *GraphQLParser) mapGraphQLTypeToJSONType(graphQLType string) string {
	switch graphQLType {
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

// Utility functions

func isBuiltInType(typeName string) bool {
	switch typeName {
	case "Int", "Float", "String", "Boolean", "ID",
		"DateTime", "Date", "Time", "BigInt", "BigDecimal",
		"Upload", "Any", "Scalar":
		return true
	default:
		return false
	}
}
