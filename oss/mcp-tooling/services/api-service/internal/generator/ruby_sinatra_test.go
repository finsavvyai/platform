package generator

import (
	"context"
	"strings"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRubySinatraGenerator(t *testing.T) {
	gen := NewRubySinatraGenerator()

	assert.NotNil(t, gen)
	assert.Equal(t, "ruby", gen.GetLanguage())
	assert.Equal(t, "sinatra", gen.GetRuntime())
	assert.Equal(t, "1.0.0", gen.GetVersion())

	features := gen.GetSupportedFeatures()
	assert.Contains(t, features, FeatureBasicGeneration)
	assert.Contains(t, features, FeatureTypeGeneration)
	assert.Contains(t, features, FeatureAuthGeneration)
	assert.Contains(t, features, FeatureValidation)
	assert.Contains(t, features, FeatureErrorHandling)
	assert.Contains(t, features, FeatureRetryLogic)
	assert.Contains(t, features, FeatureLogging)
	assert.Contains(t, features, FeatureRESTSupport)
	assert.Contains(t, features, FeatureInlineDocs)
	assert.Contains(t, features, FeatureExamples)
}

func TestRubySinatraGenerator_Generate(t *testing.T) {
	gen := NewRubySinatraGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "Test API Description",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUser",
				Name:        "getUser",
				Description: "Get user by ID",
				Method:      "GET",
				Path:        "/users/{id}",
				Parameters: []parser.Parameter{
					{
						Name:        "id",
						In:          "path",
						Required:    true,
						Description: "User ID",
						Schema: &parser.TypeReference{
							Type: "string",
						},
					},
				},
			},
			{
				ID:          "createUser",
				Name:        "createUser",
				Description: "Create a new user",
				Method:      "POST",
				Path:        "/users",
				RequestBody: &parser.RequestBody{
					Required:    true,
					ContentType: "application/json",
				},
			},
		},
		Servers: []parser.ServerConfig{
			{
				URL: "https://api.test.com",
			},
		},
	}

	opts := GenerateOptions{
		Language:     "ruby",
		Runtime:      "sinatra",
		PackageName:  "TestApi",
		IncludeDocs:  true,
		IncludeTests: true,
	}

	code, err := gen.Generate(ctx, ir, opts)

	require.NoError(t, err)
	require.NotNil(t, code)

	// Verify code structure
	assert.Equal(t, "ruby", code.Language)
	assert.Equal(t, "sinatra", code.Runtime)
	assert.Equal(t, 11, len(code.Files))

	// Verify files exist
	fileMap := make(map[string]GeneratedFile)
	for _, file := range code.Files {
		fileMap[file.Path] = file
	}

	assert.Contains(t, fileMap, "app.rb")
	assert.Contains(t, fileMap, "lib/mcp_service.rb")
	assert.Contains(t, fileMap, "lib/api_client.rb")
	assert.Contains(t, fileMap, "lib/models.rb")
	assert.Contains(t, fileMap, "config.ru")
	assert.Contains(t, fileMap, "Gemfile")
	assert.Contains(t, fileMap, "config/environment.rb")
	assert.Contains(t, fileMap, "spec/app_spec.rb")
	assert.Contains(t, fileMap, "spec/spec_helper.rb")
	assert.Contains(t, fileMap, "README.md")
	assert.Contains(t, fileMap, "Dockerfile")

	// Verify app.rb
	appFile := fileMap["app.rb"]
	assert.Equal(t, FileTypeSource, appFile.Type)
	assert.Contains(t, appFile.Content, "class App < Sinatra::Base")
	assert.Contains(t, appFile.Content, "get '/.well-known/mcp.json'")
	assert.Contains(t, appFile.Content, "post '/mcp/execute'")

	// Verify service
	serviceFile := fileMap["lib/mcp_service.rb"]
	assert.Contains(t, serviceFile.Content, "class McpService")
	assert.Contains(t, serviceFile.Content, "def execute_get_user")
	assert.Contains(t, serviceFile.Content, "def execute_create_user")

	// Verify metadata
	assert.Equal(t, "TestApi", code.Metadata.Extensions["module_name"])
	assert.Equal(t, 2, code.Metadata.Extensions["endpoints_count"])
	assert.Equal(t, false, code.Metadata.Extensions["has_auth"])
}

func TestRubySinatraGenerator_Generate_WithAuth(t *testing.T) {
	tests := []struct {
		name       string
		authScheme parser.AuthScheme
		expected   string
	}{
		{
			name: "API Key Header",
			authScheme: parser.AuthScheme{
				Type: "apiKey",
				In:   "header",
				Name: "X-API-Key",
			},
			expected: "request[@api_key_header] = @api_key",
		},
		{
			name: "Bearer Token",
			authScheme: parser.AuthScheme{
				Type:   "http",
				Scheme: "bearer",
			},
			expected: "request['Authorization'] = \"Bearer #{@bearer_token}\"",
		},
		{
			name: "OAuth2",
			authScheme: parser.AuthScheme{
				Type: "oauth2",
			},
			expected: "request['Authorization'] = \"Bearer #{@access_token}\"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gen := NewRubySinatraGenerator()
			ctx := context.Background()

			ir := &parser.IntermediateRepresentation{
				Metadata: parser.APIMetadata{
					Name: "test-api",
				},
				Endpoints: []parser.UnifiedEndpoint{
					{
						ID:     "test",
						Name:   "test",
						Method: "GET",
						Path:   "/test",
					},
				},
				Auth: []parser.AuthScheme{tt.authScheme},
				Servers: []parser.ServerConfig{
					{URL: "https://api.test.com"},
				},
			}

			opts := GenerateOptions{
				IncludeDocs:  true,
				IncludeTests: true,
			}

			code, err := gen.Generate(ctx, ir, opts)

			require.NoError(t, err)
			require.NotNil(t, code)

			// Find api_client.rb
			var apiClientContent string
			for _, file := range code.Files {
				if file.Path == "lib/api_client.rb" {
					apiClientContent = file.Content
					break
				}
			}

			assert.NotEmpty(t, apiClientContent)
			assert.Contains(t, apiClientContent, tt.expected)
			assert.Equal(t, true, code.Metadata.Extensions["has_auth"])
		})
	}
}

func TestRubySinatraGenerator_GenerateApp(t *testing.T) {
	gen := NewRubySinatraGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-service",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUsers",
				Name:        "getUsers",
				Method:      "GET",
				Path:        "/users",
				Description: "Get all users",
			},
		},
	}

	content, err := gen.generateApp(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "module TestService")
	assert.Contains(t, content, "class App < Sinatra::Base")
	assert.Contains(t, content, "get '/.well-known/mcp.json'")
	assert.Contains(t, content, "post '/mcp/execute'")
	assert.Contains(t, content, "get '/health'")
	assert.Contains(t, content, "get '/users'")
}

func TestRubySinatraGenerator_GenerateMcpService(t *testing.T) {
	gen := NewRubySinatraGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "user-service",
			Description: "User management API",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUsers",
				Name:        "getUsers",
				Method:      "GET",
				Path:        "/users",
				Description: "Get all users",
			},
			{
				ID:          "createUser",
				Name:        "createUser",
				Method:      "POST",
				Path:        "/users",
				Description: "Create user",
			},
		},
	}

	content, err := gen.generateMcpService(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "module UserService")
	assert.Contains(t, content, "class McpService")
	assert.Contains(t, content, "def manifest")
	assert.Contains(t, content, "def execute_tool")
	assert.Contains(t, content, "def execute_get_users")
	assert.Contains(t, content, "def execute_create_user")
	assert.Contains(t, content, "when 'getUsers'")
	assert.Contains(t, content, "when 'createUser'")
}

func TestRubySinatraGenerator_GenerateGemfile(t *testing.T) {
	gen := NewRubySinatraGenerator()

	ir := &parser.IntermediateRepresentation{}

	content, err := gen.generateGemfile(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "gem 'sinatra'")
	assert.Contains(t, content, "gem 'puma'")
	assert.Contains(t, content, "gem 'rspec'")
	assert.Contains(t, content, "gem 'rack-test'")
	assert.Contains(t, content, "gem 'rubocop'")
}

func TestRubySinatraGenerator_GenerateReadme(t *testing.T) {
	gen := NewRubySinatraGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "user-api",
			Description: "User management service",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUsers",
				Name:        "getUsers",
				Method:      "GET",
				Path:        "/users",
				Description: "Get all users",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.users.com"},
		},
	}

	content, err := gen.generateReadme(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "# UserApi - MCP Server")
	assert.Contains(t, content, "User management service")
	assert.Contains(t, content, "https://api.users.com")
	assert.Contains(t, content, "## Prerequisites")
	assert.Contains(t, content, "Ruby >= 2.7.0")
	assert.Contains(t, content, "bundle install")
	assert.Contains(t, content, "bundle exec rackup")
	assert.Contains(t, content, "bundle exec rspec")
	assert.Contains(t, content, "getUsers")
}

func TestRubySinatraGenerator_GetModuleName(t *testing.T) {
	tests := []struct {
		name     string
		metadata parser.APIMetadata
		expected string
	}{
		{
			name:     "simple name",
			metadata: parser.APIMetadata{Name: "api"},
			expected: "Api",
		},
		{
			name:     "hyphenated name",
			metadata: parser.APIMetadata{Name: "user-service"},
			expected: "UserService",
		},
		{
			name:     "multi-word name",
			metadata: parser.APIMetadata{Name: "my-cool-api"},
			expected: "MyCoolApi",
		},
		{
			name:     "uses title when name empty",
			metadata: parser.APIMetadata{Title: "test-api"},
			expected: "TestApi",
		},
		{
			name:     "empty",
			metadata: parser.APIMetadata{},
			expected: "McpServer",
		},
	}

	gen := NewRubySinatraGenerator()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ir := &parser.IntermediateRepresentation{
				Metadata: tt.metadata,
			}

			result := gen.getModuleName(ir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRubySinatraGenerator_TypeToJsonSchema(t *testing.T) {
	tests := []struct {
		irType   string
		expected string
	}{
		{"string", "string"},
		{"integer", "integer"},
		{"int", "integer"},
		{"int32", "integer"},
		{"int64", "integer"},
		{"number", "number"},
		{"float", "number"},
		{"double", "number"},
		{"boolean", "boolean"},
		{"bool", "boolean"},
		{"array", "array"},
		{"object", "object"},
		{"unknown", "string"},
	}

	gen := NewRubySinatraGenerator()

	for _, tt := range tests {
		t.Run(tt.irType, func(t *testing.T) {
			result := gen.typeToJsonSchema(tt.irType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRubySinatraGenerator_ToSnakeCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"getUser", "get_user"},
		{"createNewUser", "create_new_user"},
		{"API", "a_p_i"},
		{"getUserID", "get_user_i_d"},
	}

	gen := NewRubySinatraGenerator()

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := gen.toSnakeCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRubySinatraGenerator_CompleteGeneration(t *testing.T) {
	gen := NewRubySinatraGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "pet-store",
			Description: "A sample Pet Store API",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "listPets",
				Name:        "listPets",
				Method:      "GET",
				Path:        "/pets",
				Description: "List all pets",
				Parameters: []parser.Parameter{
					{
						Name:        "limit",
						In:          "query",
						Required:    false,
						Description: "How many items to return",
						Schema: &parser.TypeReference{
							Type: "integer",
						},
					},
				},
			},
			{
				ID:          "createPet",
				Name:        "createPet",
				Method:      "POST",
				Path:        "/pets",
				Description: "Create a pet",
				RequestBody: &parser.RequestBody{
					Required:    true,
					ContentType: "application/json",
				},
			},
			{
				ID:          "getPet",
				Name:        "getPet",
				Method:      "GET",
				Path:        "/pets/{petId}",
				Description: "Info for a specific pet",
				Parameters: []parser.Parameter{
					{
						Name:        "petId",
						In:          "path",
						Required:    true,
						Description: "The id of the pet to retrieve",
						Schema: &parser.TypeReference{
							Type: "string",
						},
					},
				},
			},
		},
		Auth: []parser.AuthScheme{
			{
				Type:   "http",
				Scheme: "bearer",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://petstore.swagger.io/v1"},
		},
	}

	opts := GenerateOptions{
		IncludeDocs:  true,
		IncludeTests: true,
	}

	code, err := gen.Generate(ctx, ir, opts)

	require.NoError(t, err)
	require.NotNil(t, code)

	// Verify all files generated
	assert.Equal(t, 11, len(code.Files))

	// Verify metadata
	assert.Equal(t, "PetStore", code.Metadata.Extensions["module_name"])
	assert.Equal(t, 3, code.Metadata.Extensions["endpoints_count"])
	assert.Equal(t, true, code.Metadata.Extensions["has_auth"])

	// Verify service contains all endpoints
	var serviceContent string
	for _, file := range code.Files {
		if file.Path == "lib/mcp_service.rb" {
			serviceContent = file.Content
			break
		}
	}

	assert.Contains(t, serviceContent, "def execute_list_pets")
	assert.Contains(t, serviceContent, "def execute_create_pet")
	assert.Contains(t, serviceContent, "def execute_get_pet")
	assert.Contains(t, serviceContent, "when 'listPets'")
	assert.Contains(t, serviceContent, "when 'createPet'")
	assert.Contains(t, serviceContent, "when 'getPet'")
}

func TestRubySinatraGenerator_ValidRubySyntax(t *testing.T) {
	gen := NewRubySinatraGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-api",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "test_endpoint",
				Name:        "test_endpoint",
				Method:      "GET",
				Path:        "/test",
				Description: "Test endpoint with 'quotes' and \"double quotes\"",
			},
		},
	}

	opts := GenerateOptions{}

	code, err := gen.Generate(ctx, ir, opts)

	require.NoError(t, err)
	require.NotNil(t, code)

	// Check that all Ruby files have valid syntax structure
	for _, file := range code.Files {
		if strings.HasSuffix(file.Path, ".rb") {
			// Basic Ruby syntax checks
			assert.True(t, strings.Contains(file.Content, "module") ||
				strings.Contains(file.Content, "class") ||
				strings.Contains(file.Content, "def") ||
				strings.Contains(file.Content, "require"),
				"Ruby file should contain module, class, def, or require: %s", file.Path)

			// Check for frozen string literal
			if !strings.Contains(file.Path, "spec") {
				assert.Contains(t, file.Content, "# frozen_string_literal: true",
					"Ruby file should have frozen string literal comment: %s", file.Path)
			}
		}
	}
}

func TestRubySinatraGenerator_GenerateTests(t *testing.T) {
	gen := NewRubySinatraGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "user-api",
		},
	}

	content, err := gen.generateTests(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "RSpec.describe UserApi::App")
	assert.Contains(t, content, "describe 'GET /.well-known/mcp.json'")
	assert.Contains(t, content, "describe 'POST /mcp/execute'")
	assert.Contains(t, content, "describe 'GET /health'")
	assert.Contains(t, content, "describe 'CORS headers'")
}
