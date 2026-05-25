package generator

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewTypeScriptCloudflareGenerator(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	assert.NotNil(t, gen)
	assert.Equal(t, "typescript", gen.GetLanguage())
	assert.Equal(t, "cloudflare-worker", gen.GetRuntime())
	assert.Equal(t, "1.0.0", gen.GetVersion())

	// Check features
	features := gen.GetSupportedFeatures()
	assert.Contains(t, features, FeatureBasicGeneration)
	assert.Contains(t, features, FeatureTypeGeneration)
	assert.Contains(t, features, FeatureAuthGeneration)
	assert.Contains(t, features, FeatureCloudflareWorker)
}

func TestTypeScriptCloudflareGenerator_Generate(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "Test API",
			Title:       "Test API",
			Description: "A test API",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUser",
				Name:        "Get User",
				Description: "Fetch user by ID",
				Method:      "GET",
				Path:        "/users/{id}",
				Parameters: []parser.Parameter{
					{
						Name:     "id",
						In:       "path",
						Required: true,
						Schema: &parser.TypeReference{
							Type: "string",
						},
					},
				},
				Responses: []parser.Response{
					{
						StatusCode:  "200",
						Description: "Success",
						Schema: &parser.TypeReference{
							Type: "object",
						},
					},
				},
			},
		},
		Servers: []parser.ServerConfig{
			{
				URL: "https://api.example.com",
			},
		},
	}

	opts := GenerateOptions{
		Language:     "typescript",
		Runtime:      "cloudflare-worker",
		PackageName:  "test-api",
		IncludeTests: true,
		IncludeDocs:  true,
	}

	result, err := gen.Generate(ctx, ir, opts)
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Check metadata
	assert.Equal(t, "typescript", result.Language)
	assert.Equal(t, "cloudflare-worker", result.Runtime)
	assert.Greater(t, len(result.Files), 0)

	// Check generated files
	fileTypes := make(map[string]bool)
	for _, file := range result.Files {
		fileTypes[file.Path] = true
	}

	assert.True(t, fileTypes["src/index.ts"])
	assert.True(t, fileTypes["src/types.ts"])
	assert.True(t, fileTypes["src/tools.ts"])
	assert.True(t, fileTypes["package.json"])
	assert.True(t, fileTypes["wrangler.toml"])
	assert.True(t, fileTypes["README.md"])
	assert.True(t, fileTypes["src/index.test.ts"])
}

func TestTypeScriptCloudflareGenerator_GenerateMainFile(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "Test API",
			Title:       "Test API",
			Description: "A test API",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "test",
				Name:        "Test",
				Description: "Test endpoint",
				Method:      "GET",
				Path:        "/test",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	file, err := gen.generateMainFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/index.ts", file.Path)
	assert.Equal(t, FileTypeSource, file.Type)
	assert.Equal(t, "typescript", file.Language)
	assert.Contains(t, file.Content, "export default")
	assert.Contains(t, file.Content, "async fetch")
	assert.Contains(t, file.Content, "/.well-known/mcp.json")
	assert.Contains(t, file.Content, "/mcp/execute")
	assert.Contains(t, file.Content, "executeTool")
}

func TestTypeScriptCloudflareGenerator_GenerateTypesFile(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Types: []parser.TypeDefinition{
			{
				Name: "User",
				Type: "object",
				Properties: map[string]parser.PropertyDefinition{
					"id": {
						Type:        "string",
						Description: "User ID",
					},
					"name": {
						Type:        "string",
						Description: "User name",
					},
				},
				Required: []string{"id"},
			},
		},
		Endpoints: []parser.UnifiedEndpoint{},
	}

	file, err := gen.generateTypesFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/types.ts", file.Path)
	assert.Contains(t, file.Content, "export interface MCPServer")
	assert.Contains(t, file.Content, "export interface MCPTool")
	assert.Contains(t, file.Content, "export interface User")
	assert.Contains(t, file.Content, "id: string")
	assert.Contains(t, file.Content, "name?: string")
}

func TestTypeScriptCloudflareGenerator_GenerateToolsFile(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUser",
				Name:        "Get User",
				Description: "Fetch user by ID",
				Method:      "GET",
				Path:        "/users/{id}",
				Parameters: []parser.Parameter{
					{
						Name:     "id",
						In:       "path",
						Required: true,
						Schema: &parser.TypeReference{
							Type: "string",
						},
						Description: "User ID",
					},
				},
			},
		},
	}

	file, err := gen.generateToolsFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/tools.ts", file.Path)
	assert.Contains(t, file.Content, "export const tools")
	assert.Contains(t, file.Content, "name: 'get_user'")
	assert.Contains(t, file.Content, "description: 'Fetch user by ID'")
	assert.Contains(t, file.Content, "properties:")
	assert.Contains(t, file.Content, "id:")
	assert.Contains(t, file.Content, "required: ['id']")
}

func TestTypeScriptCloudflareGenerator_GeneratePackageJSON(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Description: "Test API",
			Version:     "1.0.0",
		},
	}

	file, err := gen.generatePackageJSON(ir, GenerateOptions{
		PackageName: "my-test-api",
	})
	require.NoError(t, err)

	assert.Equal(t, "package.json", file.Path)
	assert.Equal(t, FileTypeConfig, file.Type)
	assert.Contains(t, file.Content, `"name": "my-test-api"`)
	assert.Contains(t, file.Content, `"version": "1.0.0"`)
	assert.Contains(t, file.Content, `"@cloudflare/workers-types"`)
	assert.Contains(t, file.Content, `"wrangler"`)
}

func TestTypeScriptCloudflareGenerator_GenerateWranglerConfig(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-api",
		},
	}

	file, err := gen.generateWranglerConfig(ir, GenerateOptions{
		PackageName: "my-worker",
	})
	require.NoError(t, err)

	assert.Equal(t, "wrangler.toml", file.Path)
	assert.Equal(t, FileTypeConfig, file.Type)
	assert.Contains(t, file.Content, `name = "my-worker"`)
	assert.Contains(t, file.Content, `main = "src/index.ts"`)
	assert.Contains(t, file.Content, `compatibility_date`)
}

func TestTypeScriptCloudflareGenerator_GenerateReadme(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Title:       "Test API",
			Description: "A test API for testing",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUser",
				Name:        "Get User",
				Description: "Fetch user",
				Method:      "GET",
				Path:        "/users/{id}",
			},
		},
	}

	file, err := gen.generateReadme(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "README.md", file.Path)
	assert.Equal(t, FileTypeDocs, file.Type)
	assert.Contains(t, file.Content, "# Test API")
	assert.Contains(t, file.Content, "A test API for testing")
	assert.Contains(t, file.Content, "## Installation")
	assert.Contains(t, file.Content, "## Development")
	assert.Contains(t, file.Content, "## Deployment")
	assert.Contains(t, file.Content, "### get_user")
}

func TestTypeScriptCloudflareGenerator_GenerateTestFile(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "Test API",
		},
	}

	file, err := gen.generateTestFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/index.test.ts", file.Path)
	assert.Equal(t, FileTypeTest, file.Type)
	assert.Contains(t, file.Content, "import")
	assert.Contains(t, file.Content, "describe")
	assert.Contains(t, file.Content, "it")
	assert.Contains(t, file.Content, "expect")
}

func TestTypeScriptCloudflareGenerator_GetToolName(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	tests := []struct {
		endpoint parser.UnifiedEndpoint
		expected string
	}{
		{
			endpoint: parser.UnifiedEndpoint{
				ID:   "getUser",
				Name: "Get User",
			},
			expected: "get_user",
		},
		{
			endpoint: parser.UnifiedEndpoint{
				ID:   "createOrder",
				Name: "",
			},
			expected: "create_order",
		},
		{
			endpoint: parser.UnifiedEndpoint{
				ID:   "list-items",
				Name: "List Items",
			},
			expected: "list_items",
		},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := gen.getToolName(tt.endpoint)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTypeScriptCloudflareGenerator_GenerateTypeDefinition(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	typeDef := parser.TypeDefinition{
		Name: "User",
		Type: "object",
		Properties: map[string]parser.PropertyDefinition{
			"id": {
				Type:        "string",
				Description: "User ID",
			},
			"email": {
				Type:        "string",
				Description: "User email",
			},
			"age": {
				Type: "integer",
			},
		},
		Required: []string{"id", "email"},
	}

	result := gen.generateTypeDefinition(typeDef)

	assert.Contains(t, result, "export interface User")
	assert.Contains(t, result, "id: string")
	assert.Contains(t, result, "email: string")
	assert.Contains(t, result, "age?: number") // Optional field uses ?
	assert.Contains(t, result, "/** User ID */")
	assert.Contains(t, result, "/** User email */")
}

func TestTypeScriptCloudflareGenerator_GenerateExecutorFunction(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	endpoint := parser.UnifiedEndpoint{
		ID:          "getUser",
		Name:        "Get User",
		Description: "Fetch user by ID",
		Method:      "GET",
		Path:        "/users/{id}",
		Parameters: []parser.Parameter{
			{
				Name:     "id",
				In:       "path",
				Required: true,
			},
			{
				Name: "fields",
				In:   "query",
			},
		},
	}

	ir := &parser.IntermediateRepresentation{
		Auth: []parser.AuthScheme{},
	}

	result := gen.generateExecutorFunction(endpoint, ir, GenerateOptions{})

	assert.Contains(t, result, "async function execute_get_user")
	assert.Contains(t, result, "/users/${args.id}")
	assert.Contains(t, result, "params.append('fields'")
	assert.Contains(t, result, "method: 'GET'")
	assert.Contains(t, result, "await fetch")
}

func TestTypeScriptCloudflareGenerator_GenerateDependencies(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	ir := &parser.IntermediateRepresentation{}

	deps := gen.generateDependencies(ir, GenerateOptions{})

	assert.GreaterOrEqual(t, len(deps), 3)

	// Check for required dependencies
	foundWorkerTypes := false
	foundTypeScript := false
	foundWrangler := false

	for _, dep := range deps {
		if dep.Name == "@cloudflare/workers-types" {
			foundWorkerTypes = true
			assert.Equal(t, DependencyTypeDev, dep.Type)
			assert.True(t, dep.Required)
		}
		if dep.Name == "typescript" {
			foundTypeScript = true
		}
		if dep.Name == "wrangler" {
			foundWrangler = true
		}
	}

	assert.True(t, foundWorkerTypes)
	assert.True(t, foundTypeScript)
	assert.True(t, foundWrangler)
}

func TestEscapeString(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Hello World", "Hello World"},
		{"It's working", "It\\'s working"},
		{"Line 1\nLine 2", "Line 1\\nLine 2"},
		{"Quote's and\nnewlines", "Quote\\'s and\\nnewlines"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := escapeString(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSanitizeIdentifier(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello_world", "hello_world"},
		{"hello-world", "hello_world"},
		{"hello world", "hello_world"},
		{"hello.world", "hello_world"},
		{"hello123", "hello123"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := sanitizeIdentifier(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTypeScriptCloudflareGenerator_WithAuthentication(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Secure API",
			Title:   "Secure API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "secureEndpoint",
				Method: "GET",
				Path:   "/secure",
				Auth:   []string{"bearer"},
			},
		},
		Auth: []parser.AuthScheme{
			{
				Type: "http",
				Name: "bearer",
			},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{})
	require.NoError(t, err)

	// Find main file
	var mainFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "src/index.ts" {
			mainFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, mainFile)
	assert.Contains(t, mainFile.Content, "API_KEY")
	assert.Contains(t, mainFile.Content, "Authorization")
}

func TestTypeScriptCloudflareGenerator_ComplexEndpoint(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()

	endpoint := parser.UnifiedEndpoint{
		ID:          "createUser",
		Name:        "Create User",
		Description: "Create a new user",
		Method:      "POST",
		Path:        "/users",
		Parameters: []parser.Parameter{
			{
				Name:     "apiVersion",
				In:       "query",
				Required: false,
			},
		},
		RequestBody: &parser.RequestBody{
			Required: true,
			Schema: &parser.TypeReference{
				Type: "object",
			},
		},
		Responses: []parser.Response{
			{
				StatusCode:  "201",
				Description: "Created",
			},
			{
				StatusCode:  "400",
				Description: "Bad Request",
			},
		},
	}

	ir := &parser.IntermediateRepresentation{
		Auth: []parser.AuthScheme{},
	}

	result := gen.generateExecutorFunction(endpoint, ir, GenerateOptions{})

	assert.Contains(t, result, "async function execute_create_user")
	assert.Contains(t, result, "method: 'POST'")
	assert.Contains(t, result, "body: JSON.stringify(args.body)")
	assert.Contains(t, result, "apiVersion")
}

func TestTypeScriptCloudflareGenerator_Statistics(t *testing.T) {
	gen := NewTypeScriptCloudflareGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{ID: "endpoint1", Method: "GET", Path: "/test1"},
			{ID: "endpoint2", Method: "POST", Path: "/test2"},
			{ID: "endpoint3", Method: "PUT", Path: "/test3"},
		},
		Types: []parser.TypeDefinition{
			{Name: "Type1", Type: "object"},
			{Name: "Type2", Type: "object"},
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{
		IncludeTests: true,
		IncludeDocs:  true,
	})
	require.NoError(t, err)

	stats := result.Metadata.Statistics
	assert.Equal(t, 3, stats.TotalEndpoints)
	assert.Equal(t, 2, stats.TotalTypes)
	assert.Greater(t, stats.TotalFiles, 0)
	assert.Greater(t, stats.TotalLines, 0)
	assert.GreaterOrEqual(t, stats.GenerationTime.Nanoseconds(), int64(0))
}
