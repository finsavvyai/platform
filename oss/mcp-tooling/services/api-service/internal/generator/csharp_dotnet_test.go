package generator

import (
	"context"
	"strings"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCSharpDotNetGenerator(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

	assert.NotNil(t, gen)
	assert.Equal(t, "csharp", gen.GetLanguage())
	assert.Equal(t, "dotnet", gen.GetRuntime())
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
	assert.Contains(t, features, FeatureAsyncAwait)
}

func TestCSharpDotNetGenerator_Generate(t *testing.T) {
	gen := NewCSharpDotNetGenerator()
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
		Language:     "csharp",
		Runtime:      "dotnet",
		PackageName:  "TestApi",
		IncludeDocs:  true,
		IncludeTests: true,
	}

	code, err := gen.Generate(ctx, ir, opts)

	require.NoError(t, err)
	require.NotNil(t, code)

	// Verify code structure
	assert.Equal(t, "csharp", code.Language)
	assert.Equal(t, "dotnet", code.Runtime)
	assert.Equal(t, 15, len(code.Files))

	// Verify files exist
	fileMap := make(map[string]GeneratedFile)
	for _, file := range code.Files {
		fileMap[file.Path] = file
	}

	assert.Contains(t, fileMap, "Program.cs")
	assert.Contains(t, fileMap, "Controllers/McpController.cs")
	assert.Contains(t, fileMap, "Services/McpService.cs")
	assert.Contains(t, fileMap, "Services/IApiClient.cs")
	assert.Contains(t, fileMap, "Services/ApiClient.cs")
	assert.Contains(t, fileMap, "Models/ExecuteRequest.cs")
	assert.Contains(t, fileMap, "Models/ExecuteResponse.cs")
	assert.Contains(t, fileMap, "Models/McpManifest.cs")
	assert.Contains(t, fileMap, "Models/Tool.cs")
	assert.Contains(t, fileMap, "TestApi.csproj")
	assert.Contains(t, fileMap, "appsettings.json")
	assert.Contains(t, fileMap, "README.md")
	assert.Contains(t, fileMap, "Tests/TestApi.Tests.csproj")
	assert.Contains(t, fileMap, "Tests/McpServiceTests.cs")

	// Verify Program.cs
	programFile := fileMap["Program.cs"]
	assert.Equal(t, FileTypeSource, programFile.Type)
	assert.Contains(t, programFile.Content, "using Microsoft.AspNetCore.Builder")
	assert.Contains(t, programFile.Content, "AddControllers")
	assert.Contains(t, programFile.Content, "AddCors")

	// Verify Controller
	controllerFile := fileMap["Controllers/McpController.cs"]
	assert.Contains(t, controllerFile.Content, "[ApiController]")
	assert.Contains(t, controllerFile.Content, "class McpController")
	assert.Contains(t, controllerFile.Content, "GetManifest")
	assert.Contains(t, controllerFile.Content, "ExecuteTool")

	// Verify Service
	serviceFile := fileMap["Services/McpService.cs"]
	assert.Contains(t, serviceFile.Content, "class McpService")
	assert.Contains(t, serviceFile.Content, "Execute_getUser")
	assert.Contains(t, serviceFile.Content, "Execute_createUser")

	// Verify metadata
	assert.Equal(t, "TestApi", code.Metadata.Extensions["namespace"])
	assert.Equal(t, 2, code.Metadata.Extensions["endpoints_count"])
	assert.Equal(t, false, code.Metadata.Extensions["has_auth"])
}

func TestCSharpDotNetGenerator_Generate_WithAuth(t *testing.T) {
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
			expected: "_httpClient.DefaultRequestHeaders.Add(\"X-API-Key\", apiKey)",
		},
		{
			name: "Bearer Token",
			authScheme: parser.AuthScheme{
				Type:   "http",
				Scheme: "bearer",
			},
			expected: "new System.Net.Http.Headers.AuthenticationHeaderValue(\"Bearer\", bearerToken)",
		},
		{
			name: "OAuth2",
			authScheme: parser.AuthScheme{
				Type: "oauth2",
			},
			expected: "new System.Net.Http.Headers.AuthenticationHeaderValue(\"Bearer\", accessToken)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gen := NewCSharpDotNetGenerator()
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

			// Find ApiClient.cs
			var apiClientContent string
			for _, file := range code.Files {
				if file.Path == "Services/ApiClient.cs" {
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

func TestCSharpDotNetGenerator_GenerateProgram(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-service",
		},
	}

	content, err := gen.generateProgram(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "using Microsoft.AspNetCore.Builder")
	assert.Contains(t, content, "using TestService.Services")
	assert.Contains(t, content, "var builder = WebApplication.CreateBuilder(args)")
	assert.Contains(t, content, "AddControllers()")
	assert.Contains(t, content, "AddCors")
	assert.Contains(t, content, "AddSingleton<IApiClient, ApiClient>()")
	assert.Contains(t, content, "app.Run()")
}

func TestCSharpDotNetGenerator_GenerateController(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "user-api",
		},
	}

	content, err := gen.generateController(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "namespace UserApi.Controllers")
	assert.Contains(t, content, "class McpController : ControllerBase")
	assert.Contains(t, content, "[ApiController]")
	assert.Contains(t, content, "[HttpGet(\".well-known/mcp.json\")]")
	assert.Contains(t, content, "[HttpPost(\"mcp/execute\")]")
	assert.Contains(t, content, "[HttpGet(\"health\")]")
}

func TestCSharpDotNetGenerator_GenerateService(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

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

	content, err := gen.generateService(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "namespace UserService.Services")
	assert.Contains(t, content, "class McpService")
	assert.Contains(t, content, "GetManifest()")
	assert.Contains(t, content, "ExecuteToolAsync")
	assert.Contains(t, content, "Execute_getUsers")
	assert.Contains(t, content, "Execute_createUser")
	assert.Contains(t, content, "GETAsync")
	assert.Contains(t, content, "POSTAsync")
	assert.Contains(t, content, "case \"getUsers\":")
	assert.Contains(t, content, "case \"createUser\":")
}

func TestCSharpDotNetGenerator_GenerateCsproj(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

	ir := &parser.IntermediateRepresentation{}

	content, err := gen.generateCsproj(ir)

	require.NoError(t, err)
	assert.Contains(t, content, "<Project Sdk=\"Microsoft.NET.Sdk.Web\">")
	assert.Contains(t, content, "<TargetFramework>net8.0</TargetFramework>")
	assert.Contains(t, content, "<Nullable>enable</Nullable>")
	assert.Contains(t, content, "Microsoft.AspNetCore.OpenApi")
	assert.Contains(t, content, "Swashbuckle.AspNetCore")
}

func TestCSharpDotNetGenerator_GenerateReadme(t *testing.T) {
	gen := NewCSharpDotNetGenerator()

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
	assert.Contains(t, content, ".NET 8.0 SDK")
	assert.Contains(t, content, "dotnet restore")
	assert.Contains(t, content, "dotnet run")
	assert.Contains(t, content, "dotnet test")
	assert.Contains(t, content, "getUsers")
}

func TestCSharpDotNetGenerator_GetNamespace(t *testing.T) {
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

	gen := NewCSharpDotNetGenerator()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ir := &parser.IntermediateRepresentation{
				Metadata: tt.metadata,
			}

			result := gen.getNamespace(ir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCSharpDotNetGenerator_TypeToJsonSchema(t *testing.T) {
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

	gen := NewCSharpDotNetGenerator()

	for _, tt := range tests {
		t.Run(tt.irType, func(t *testing.T) {
			result := gen.typeToJsonSchema(tt.irType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCSharpDotNetGenerator_CompleteGeneration(t *testing.T) {
	gen := NewCSharpDotNetGenerator()
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
	assert.Equal(t, 15, len(code.Files))

	// Verify metadata
	assert.Equal(t, "PetStore", code.Metadata.Extensions["namespace"])
	assert.Equal(t, 3, code.Metadata.Extensions["endpoints_count"])
	assert.Equal(t, true, code.Metadata.Extensions["has_auth"])

	// Verify service contains all endpoints
	var serviceContent string
	for _, file := range code.Files {
		if file.Path == "Services/McpService.cs" {
			serviceContent = file.Content
			break
		}
	}

	assert.Contains(t, serviceContent, "Execute_listPets")
	assert.Contains(t, serviceContent, "Execute_createPet")
	assert.Contains(t, serviceContent, "Execute_getPet")
	assert.Contains(t, serviceContent, "case \"listPets\":")
	assert.Contains(t, serviceContent, "case \"createPet\":")
	assert.Contains(t, serviceContent, "case \"getPet\":")
}

func TestCSharpDotNetGenerator_ValidCSharpSyntax(t *testing.T) {
	gen := NewCSharpDotNetGenerator()
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

	// Check that all C# files have valid syntax structure
	for _, file := range code.Files {
		if strings.HasSuffix(file.Path, ".cs") {
			// Basic C# syntax checks
			assert.True(t, strings.Contains(file.Content, "namespace") ||
				strings.Contains(file.Content, "using"),
				"C# file should contain namespace or using statements: %s", file.Path)

			// Check balanced braces
			openBraces := strings.Count(file.Content, "{")
			closeBraces := strings.Count(file.Content, "}")
			assert.Equal(t, openBraces, closeBraces,
				"Unbalanced braces in %s", file.Path)
		}
	}
}
