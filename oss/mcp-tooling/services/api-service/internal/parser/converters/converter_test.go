package converters

import (
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// TestOpenAPIToIRConverter tests OpenAPI to IR conversion
func TestOpenAPIToIRConverter(t *testing.T) {
	converter := NewOpenAPIToIRConverter()

	// Create sample OpenAPI spec
	spec := &parser.ParsedSpec{
		Info: parser.SpecInfo{
			Title:       "Test API",
			Description: "A test API",
			Version:     "1.0.0",
		},
		Servers: []parser.Server{
			{
				URL:         "https://api.example.com",
				Description: "Production server",
			},
		},
		Paths: map[string]parser.Path{
			"/users": {
				Operations: map[string]*parser.Operation{
					"get": {
						ID:          "getUsers",
						Summary:     "Get users",
						Description: "Retrieve list of users",
						Parameters: []parser.Parameter{
							{
								Name:        "limit",
								In:          "query",
								Description: "Limit results",
								Required:    false,
								Schema: &parser.Schema{
									Type: "integer",
								},
							},
						},
						Responses: map[string]parser.Response{
							"200": {
								Description: "Success",
							},
						},
					},
				},
			},
		},
	}

	// Convert
	ir, err := converter.Convert(spec)
	if err != nil {
		t.Fatalf("Convert() error = %v", err)
	}

	// Verify metadata
	if ir.Metadata.Name != "Test API" {
		t.Errorf("Metadata.Name = %v, want Test API", ir.Metadata.Name)
	}

	if ir.Metadata.Version != "1.0.0" {
		t.Errorf("Metadata.Version = %v, want 1.0.0", ir.Metadata.Version)
	}

	// Verify servers
	if len(ir.Servers) != 1 {
		t.Errorf("len(Servers) = %v, want 1", len(ir.Servers))
	}

	if len(ir.Servers) > 0 && ir.Servers[0].URL != "https://api.example.com" {
		t.Errorf("Servers[0].URL = %v, want https://api.example.com", ir.Servers[0].URL)
	}

	// Verify endpoints
	if len(ir.Endpoints) != 1 {
		t.Errorf("len(Endpoints) = %v, want 1", len(ir.Endpoints))
	}

	if len(ir.Endpoints) > 0 {
		endpoint := ir.Endpoints[0]
		if endpoint.Method != "get" {
			t.Errorf("Endpoint.Method = %v, want get", endpoint.Method)
		}
		if endpoint.Path != "/users" {
			t.Errorf("Endpoint.Path = %v, want /users", endpoint.Path)
		}
		if len(endpoint.Parameters) != 1 {
			t.Errorf("len(Endpoint.Parameters) = %v, want 1", len(endpoint.Parameters))
		}
	}

	// Verify source
	if ir.Source.Format != "openapi" {
		t.Errorf("Source.Format = %v, want openapi", ir.Source.Format)
	}
}

// TestGraphQLToIRConverter tests GraphQL to IR conversion
func TestGraphQLToIRConverter(t *testing.T) {
	converter := NewGraphQLToIRConverter()

	// Create sample GraphQL schema
	schema := &parser.GraphQLSchema{
		Info: parser.SchemaInfo{
			Title:       "Test GraphQL API",
			Description: "A test GraphQL API",
			Version:     "1.0.0",
		},
		Queries: []parser.GraphQLOperation{
			{
				Name:        "getUser",
				Type:        "query",
				Description: "Get user by ID",
				Arguments: []parser.GraphQLArgument{
					{
						Name:        "id",
						Type:        "string",
						Description: "User ID",
						Required:    true,
					},
				},
			},
		},
		Mutations: []parser.GraphQLOperation{
			{
				Name:        "createUser",
				Type:        "mutation",
				Description: "Create a new user",
				Arguments: []parser.GraphQLArgument{
					{
						Name:        "name",
						Type:        "string",
						Description: "User name",
						Required:    true,
					},
				},
			},
		},
	}

	// Convert
	ir, err := converter.Convert(schema)
	if err != nil {
		t.Fatalf("Convert() error = %v", err)
	}

	// Verify metadata
	if ir.Metadata.Name != "Test GraphQL API" {
		t.Errorf("Metadata.Name = %v, want Test GraphQL API", ir.Metadata.Name)
	}

	// Verify endpoints (1 query + 1 mutation)
	if len(ir.Endpoints) != 2 {
		t.Errorf("len(Endpoints) = %v, want 2", len(ir.Endpoints))
	}

	// Verify query endpoint
	queryFound := false
	mutationFound := false

	for _, endpoint := range ir.Endpoints {
		if endpoint.Name == "getUser" {
			queryFound = true
			if endpoint.Method != "POST" {
				t.Errorf("Query endpoint Method = %v, want POST", endpoint.Method)
			}
			if endpoint.Path != "/graphql" {
				t.Errorf("Query endpoint Path = %v, want /graphql", endpoint.Path)
			}
		}
		if endpoint.Name == "createUser" {
			mutationFound = true
			if endpoint.Method != "POST" {
				t.Errorf("Mutation endpoint Method = %v, want POST", endpoint.Method)
			}
		}
	}

	if !queryFound {
		t.Error("Query endpoint not found")
	}
	if !mutationFound {
		t.Error("Mutation endpoint not found")
	}

	// Verify source
	if ir.Source.Format != "graphql" {
		t.Errorf("Source.Format = %v, want graphql", ir.Source.Format)
	}
}

// TestPostmanToIRConverter tests Postman to IR conversion
func TestPostmanToIRConverter(t *testing.T) {
	converter := NewPostmanToIRConverter()

	// Create sample Postman collection
	collection := &parser.ParsedPostmanCollection{
		Info: parser.CollectionInfo{
			Name:        "Test Collection",
			Description: "A test collection",
			Version:     "1.0.0",
		},
		Items: []parser.ParsedCollectionItem{
			{
				Name:        "Get Users",
				Description: "Retrieve users",
				Type:        "request",
				Request: &parser.ParsedPostmanRequest{
					Method:      "GET",
					URL:         "https://api.example.com/users",
					Description: "Get all users",
					Headers: []parser.PostmanHeader{
						{
							Key:   "Accept",
							Value: "application/json",
						},
					},
				},
			},
		},
		Metadata: parser.PostmanMetadata{
			BaseURL: "https://api.example.com",
		},
	}

	// Convert
	ir, err := converter.Convert(collection)
	if err != nil {
		t.Fatalf("Convert() error = %v", err)
	}

	// Verify metadata
	if ir.Metadata.Name != "Test Collection" {
		t.Errorf("Metadata.Name = %v, want Test Collection", ir.Metadata.Name)
	}

	// Verify servers
	if len(ir.Servers) != 1 {
		t.Errorf("len(Servers) = %v, want 1", len(ir.Servers))
	}

	// Verify endpoints
	if len(ir.Endpoints) != 1 {
		t.Errorf("len(Endpoints) = %v, want 1", len(ir.Endpoints))
	}

	if len(ir.Endpoints) > 0 {
		endpoint := ir.Endpoints[0]
		if endpoint.Method != "GET" {
			t.Errorf("Endpoint.Method = %v, want GET", endpoint.Method)
		}
		if endpoint.Name != "Get Users" {
			t.Errorf("Endpoint.Name = %v, want Get Users", endpoint.Name)
		}
	}

	// Verify source
	if ir.Source.Format != "postman" {
		t.Errorf("Source.Format = %v, want postman", ir.Source.Format)
	}
}

// TestConversionRoundTrip tests that conversion preserves essential information
func TestConversionRoundTrip(t *testing.T) {
	// This test ensures that important information is not lost during conversion
	
	openAPISpec := &parser.ParsedSpec{
		Info: parser.SpecInfo{
			Title:   "Roundtrip Test",
			Version: "2.0.0",
		},
		Paths: map[string]parser.Path{
			"/test": {
				Operations: map[string]*parser.Operation{
					"post": {
						ID:      "testOp",
						Summary: "Test operation",
						Parameters: []parser.Parameter{
							{Name: "param1", In: "query", Required: true},
						},
					},
				},
			},
		},
	}

	converter := NewOpenAPIToIRConverter()
	ir, err := converter.Convert(openAPISpec)
	if err != nil {
		t.Fatalf("Convert() error = %v", err)
	}

	// Verify essential information is preserved
	if ir.Metadata.Title != openAPISpec.Info.Title {
		t.Error("Title not preserved")
	}
	if ir.Metadata.Version != openAPISpec.Info.Version {
		t.Error("Version not preserved")
	}
	if len(ir.Endpoints) == 0 {
		t.Error("Endpoints lost")
	}
	if len(ir.Endpoints) > 0 && len(ir.Endpoints[0].Parameters) != 1 {
		t.Error("Parameters lost")
	}
}
