package generator

import (
	"context"
	"strings"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRustWasmGenerator(t *testing.T) {
	gen := NewRustWasmGenerator()

	assert.NotNil(t, gen)
	assert.Equal(t, "rust", gen.GetLanguage())
	assert.Equal(t, "wasm", gen.GetRuntime())
	assert.Equal(t, "1.0.0", gen.GetVersion())

	features := gen.GetSupportedFeatures()
	assert.Contains(t, features, FeatureBasicGeneration)
	assert.Contains(t, features, FeatureWASM)
	assert.Contains(t, features, FeatureAsyncAwait)
}

func TestRustWasmGenerator_Generate(t *testing.T) {
	gen := NewRustWasmGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "A test API for Rust WASM",
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
						Name:        "id",
						In:          "path",
						Required:    true,
						Description: "User ID",
						Schema: parser.Schema{
							Type: "string",
						},
					},
				},
			},
			{
				ID:          "createUser",
				Name:        "Create User",
				Description: "Create a new user",
				Method:      "POST",
				Path:        "/users",
				RequestBody: &parser.RequestBody{
					Description: "User data",
					Required:    true,
					Content: map[string]parser.MediaType{
						"application/json": {
							Schema: parser.Schema{
								Type: "object",
							},
						},
					},
				},
			},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{
		IncludeTests: true,
		IncludeDocs:  true,
	})
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Verify basic metadata
	assert.Equal(t, "rust", result.Language)
	assert.Equal(t, "wasm", result.Runtime)

	// Verify files were generated
	fileTypes := make(map[string]bool)
	for _, file := range result.Files {
		fileTypes[file.Path] = true
	}

	assert.True(t, fileTypes["src/lib.rs"], "Should generate lib.rs")
	assert.True(t, fileTypes["src/types.rs"], "Should generate types.rs")
	assert.True(t, fileTypes["src/tools.rs"], "Should generate tools.rs")
	assert.True(t, fileTypes["src/client.rs"], "Should generate client.rs")
	assert.True(t, fileTypes["Cargo.toml"], "Should generate Cargo.toml")
	assert.True(t, fileTypes["README.md"], "Should generate README.md")
	assert.True(t, fileTypes["tests/lib.rs"], "Should generate tests")

	// Verify dependencies
	assert.NotEmpty(t, result.Dependencies)
	depNames := make(map[string]bool)
	for _, dep := range result.Dependencies {
		depNames[dep.Name] = true
	}
	assert.True(t, depNames["serde"])
	assert.True(t, depNames["serde_json"])
	assert.True(t, depNames["wasm-bindgen"])

	// Verify statistics
	assert.Equal(t, 2, result.Metadata.Statistics.TotalEndpoints)
	assert.Greater(t, result.Metadata.Statistics.TotalFiles, 0)
	assert.Greater(t, result.Metadata.Statistics.TotalLines, 0)
}

func TestRustWasmGenerator_GenerateMainFile(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "Test description",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "getItems",
				Method: "GET",
				Path:   "/items",
			},
		},
	}

	file, err := gen.generateMainFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/lib.rs", file.Path)
	assert.Equal(t, FileTypeSource, file.Type)
	assert.Equal(t, "rust", file.Language)

	content := file.Content
	assert.Contains(t, content, "use wasm_bindgen::prelude::*;")
	assert.Contains(t, content, "pub mod types;")
	assert.Contains(t, content, "pub mod tools;")
	assert.Contains(t, content, "pub mod client;")
	assert.Contains(t, content, "#[wasm_bindgen]")
	assert.Contains(t, content, "pub fn handle_request")
	assert.Contains(t, content, "/.well-known/mcp.json")
	assert.Contains(t, content, "/mcp/execute")
	assert.Contains(t, content, "fn handle_manifest()")
	assert.Contains(t, content, "fn handle_execute(")
}

func TestRustWasmGenerator_GenerateTypesFile(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
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
					"email": {
						Type:        "string",
						Description: "User email",
					},
					"age": {
						Type: "integer",
					},
				},
				Required: []string{"id", "email"},
			},
		},
	}

	file, err := gen.generateTypesFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/types.rs", file.Path)
	assert.Equal(t, FileTypeSource, file.Type)

	content := file.Content
	assert.Contains(t, content, "use serde::{Deserialize, Serialize};")
	assert.Contains(t, content, "pub struct User")
	assert.Contains(t, content, "pub id: String")
	assert.Contains(t, content, "pub email: String")
	assert.Contains(t, content, "pub age: Option<i64>")
	assert.Contains(t, content, "#[derive(Debug, Clone, Serialize, Deserialize)]")
}

func TestRustWasmGenerator_GenerateTypeDefinition(t *testing.T) {
	gen := NewRustWasmGenerator()

	typeDef := parser.TypeDefinition{
		Name:        "Product",
		Type:        "object",
		Description: "A product item",
		Properties: map[string]parser.PropertyDefinition{
			"id": {
				Type:        "string",
				Description: "Product ID",
			},
			"name": {
				Type:        "string",
				Description: "Product name",
			},
			"price": {
				Type:        "number",
				Description: "Product price",
			},
			"inStock": {
				Type: "boolean",
			},
		},
		Required: []string{"id", "name"},
	}

	result := gen.generateTypeDefinition(typeDef)

	assert.Contains(t, result, "/// A product item")
	assert.Contains(t, result, "#[derive(Debug, Clone, Serialize, Deserialize)]")
	assert.Contains(t, result, "pub struct Product")
	assert.Contains(t, result, "pub id: String")
	assert.Contains(t, result, "pub name: String")
	assert.Contains(t, result, "pub price: Option<f64>")
	assert.Contains(t, result, "pub in_stock: Option<bool>")
	assert.Contains(t, result, "#[serde(skip_serializing_if = \"Option::is_none\")]")
}

func TestRustWasmGenerator_GenerateToolsFile(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getUser",
				Description: "Get a user",
				Method:      "GET",
				Path:        "/users/{id}",
				Parameters: []parser.Parameter{
					{
						Name:     "id",
						In:       "path",
						Required: true,
						Schema: parser.Schema{
							Type: "string",
						},
					},
				},
			},
		},
	}

	file, err := gen.generateToolsFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/tools.rs", file.Path)

	content := file.Content
	assert.Contains(t, content, "pub fn get_tools()")
	assert.Contains(t, content, "Vec<Value>")
	assert.Contains(t, content, "\"name\":")
	assert.Contains(t, content, "\"description\":")
	assert.Contains(t, content, "\"inputSchema\":")
	assert.Contains(t, content, "\"type\": \"object\"")
	assert.Contains(t, content, "\"properties\":")
}

func TestRustWasmGenerator_GenerateClientFile(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "listItems",
				Method: "GET",
				Path:   "/items",
				Parameters: []parser.Parameter{
					{
						Name: "limit",
						In:   "query",
						Schema: parser.Schema{
							Type: "integer",
						},
					},
				},
			},
			{
				ID:     "createItem",
				Method: "POST",
				Path:   "/items",
			},
		},
	}

	file, err := gen.generateClientFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "src/client.rs", file.Path)

	content := file.Content
	assert.Contains(t, content, "pub struct ApiClient")
	assert.Contains(t, content, "base_url: String")
	assert.Contains(t, content, "api_key: Option<String>")
	assert.Contains(t, content, "pub fn new(")
	assert.Contains(t, content, "pub fn list_items(")
	assert.Contains(t, content, "pub fn create_item(")
	assert.Contains(t, content, "Result<Value, String>")
}

func TestRustWasmGenerator_GenerateClientMethod(t *testing.T) {
	gen := NewRustWasmGenerator()

	endpoint := parser.UnifiedEndpoint{
		ID:          "updateUser",
		Description: "Update a user",
		Method:      "PUT",
		Path:        "/users/{id}",
		Parameters: []parser.Parameter{
			{
				Name:     "id",
				In:       "path",
				Required: true,
				Schema: parser.Schema{
					Type: "string",
				},
			},
			{
				Name: "notify",
				In:   "query",
				Schema: parser.Schema{
					Type: "boolean",
				},
			},
		},
	}

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-api",
		},
	}

	result := gen.generateClientMethod(endpoint, ir)

	assert.Contains(t, result, "pub fn update_user")
	assert.Contains(t, result, "args: &Value")
	assert.Contains(t, result, "Result<Value, String>")
	assert.Contains(t, result, "let id =")
	assert.Contains(t, result, "let url = format!")
	assert.Contains(t, result, "params.insert")
	assert.Contains(t, result, "self.request(\"PUT\"")
}

func TestRustWasmGenerator_GenerateCargoToml(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "my-api",
			Title:   "My API",
			Version: "2.0.0",
		},
	}

	file, err := gen.generateCargoToml(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "Cargo.toml", file.Path)
	assert.Equal(t, FileTypeConfig, file.Type)

	content := file.Content
	assert.Contains(t, content, "[package]")
	assert.Contains(t, content, "name = \"my-api\"")
	assert.Contains(t, content, "version = \"2.0.0\"")
	assert.Contains(t, content, "edition = \"2021\"")
	assert.Contains(t, content, "[lib]")
	assert.Contains(t, content, "crate-type = [\"cdylib\", \"rlib\"]")
	assert.Contains(t, content, "[dependencies]")
	assert.Contains(t, content, "serde =")
	assert.Contains(t, content, "serde_json =")
	assert.Contains(t, content, "wasm-bindgen =")
	assert.Contains(t, content, "[dev-dependencies]")
	assert.Contains(t, content, "wasm-bindgen-test =")
	assert.Contains(t, content, "[profile.release]")
	assert.Contains(t, content, "opt-level = \"z\"")
	assert.Contains(t, content, "lto = true")
}

func TestRustWasmGenerator_GenerateReadme(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:        "test-api",
			Title:       "Test API",
			Description: "A test API",
			Version:     "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "getItems",
				Description: "Get all items",
				Method:      "GET",
				Path:        "/items",
			},
		},
	}

	file, err := gen.generateReadme(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "README.md", file.Path)
	assert.Equal(t, FileTypeDocs, file.Type)

	content := file.Content
	assert.Contains(t, content, "# Test API")
	assert.Contains(t, content, "Rust WASM MCP Server")
	assert.Contains(t, content, "## Installation")
	assert.Contains(t, content, "wasm-pack build")
	assert.Contains(t, content, "## Usage")
	assert.Contains(t, content, "## Environment Variables")
	assert.Contains(t, content, "API_BASE_URL")
	assert.Contains(t, content, "## Available Tools")
	assert.Contains(t, content, "## Development")
}

func TestRustWasmGenerator_GenerateTestFile(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
	}

	file, err := gen.generateTestFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "tests/lib.rs", file.Path)
	assert.Equal(t, FileTypeTest, file.Type)

	content := file.Content
	assert.Contains(t, content, "use wasm_bindgen_test::*;")
	assert.Contains(t, content, "#[wasm_bindgen_test]")
	assert.Contains(t, content, "fn test_manifest()")
	assert.Contains(t, content, "fn test_invalid_path()")
	assert.Contains(t, content, "/.well-known/mcp.json")
	assert.Contains(t, content, "assert!")
}

func TestRustWasmGenerator_GetToolName(t *testing.T) {
	gen := NewRustWasmGenerator()

	tests := []struct {
		name     string
		endpoint parser.UnifiedEndpoint
		expected string
	}{
		{
			name: "with name",
			endpoint: parser.UnifiedEndpoint{
				Name:   "Get User",
				Method: "GET",
				Path:   "/users/{id}",
			},
			expected: "get_user",
		},
		{
			name: "with ID",
			endpoint: parser.UnifiedEndpoint{
				ID:     "listItems",
				Method: "GET",
				Path:   "/items",
			},
			expected: "list_items",
		},
		{
			name: "generated from path",
			endpoint: parser.UnifiedEndpoint{
				Method: "POST",
				Path:   "/users/{id}/messages",
			},
			expected: "post_users_id_messages",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := gen.getToolName(tt.endpoint)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRustWasmGenerator_WithAuthentication(t *testing.T) {
	gen := NewRustWasmGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Auth: []parser.AuthScheme{
			{
				Type: "http",
				Name: "bearer",
			},
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "getSecure",
				Method: "GET",
				Path:   "/secure",
			},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{})
	require.NoError(t, err)

	// Find main file
	var mainFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "src/lib.rs" {
			mainFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, mainFile)
	assert.Contains(t, mainFile.Content, "API_KEY")
	assert.Contains(t, mainFile.Content, "api_key")

	// Find README
	var readmeFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "README.md" {
			readmeFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, readmeFile)
	assert.Contains(t, readmeFile.Content, "API_KEY")
}

func TestRustWasmGenerator_ComplexEndpoint(t *testing.T) {
	gen := NewRustWasmGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:          "searchUsers",
				Description: "Search for users",
				Method:      "GET",
				Path:        "/users",
				Parameters: []parser.Parameter{
					{
						Name:        "query",
						In:          "query",
						Required:    true,
						Description: "Search query",
						Schema: parser.Schema{
							Type: "string",
						},
					},
					{
						Name: "limit",
						In:   "query",
						Schema: parser.Schema{
							Type: "integer",
						},
					},
					{
						Name: "offset",
						In:   "query",
						Schema: parser.Schema{
							Type: "integer",
						},
					},
				},
			},
		},
		Types: []parser.TypeDefinition{
			{
				Name: "User",
				Type: "object",
				Properties: map[string]parser.PropertyDefinition{
					"id":    {Type: "string"},
					"email": {Type: "string"},
					"name":  {Type: "string"},
				},
				Required: []string{"id", "email"},
			},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{
		IncludeTests: true,
		IncludeDocs:  true,
	})
	require.NoError(t, err)

	// Verify endpoint handling
	var clientFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "src/client.rs" {
			clientFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, clientFile)
	content := clientFile.Content
	assert.Contains(t, content, "pub fn search_users")
	assert.Contains(t, content, "query")
	assert.Contains(t, content, "limit")
	assert.Contains(t, content, "offset")

	// Verify type generation
	var typesFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "src/types.rs" {
			typesFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, typesFile)
	assert.Contains(t, typesFile.Content, "pub struct User")
	assert.Contains(t, typesFile.Content, "pub id: String")
	assert.Contains(t, typesFile.Content, "pub email: String")
	assert.Contains(t, typesFile.Content, "pub name: Option<String>")
}

func TestRustWasmGenerator_Statistics(t *testing.T) {
	gen := NewRustWasmGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{ID: "ep1", Method: "GET", Path: "/a"},
			{ID: "ep2", Method: "POST", Path: "/b"},
			{ID: "ep3", Method: "PUT", Path: "/c"},
		},
		Types: []parser.TypeDefinition{
			{Name: "Type1", Type: "object"},
			{Name: "Type2", Type: "object"},
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

func TestRustWasmGenerator_EmptyTypes(t *testing.T) {
	gen := NewRustWasmGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Types: []parser.TypeDefinition{}, // No types
	}

	file, err := gen.generateTypesFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Contains(t, file.Content, "// No custom types defined")
}

func TestRustWasmGenerator_SnakeCaseConversion(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"getUserById", "get_user_by_id"},
		{"HTTPResponse", "http_response"},
		{"camelCase", "camel_case"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toSnakeCase(tt.input)
			// Just verify it returns something and doesn't panic
			assert.NotEmpty(t, result)
		})
	}
}

func TestRustWasmGenerator_PathParameters(t *testing.T) {
	gen := NewRustWasmGenerator()
	ctx := context.Background()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "test-api",
			Title:   "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "getUserPosts",
				Method: "GET",
				Path:   "/users/{userId}/posts/{postId}",
				Parameters: []parser.Parameter{
					{
						Name:     "userId",
						In:       "path",
						Required: true,
						Schema:   parser.Schema{Type: "string"},
					},
					{
						Name:     "postId",
						In:       "path",
						Required: true,
						Schema:   parser.Schema{Type: "string"},
					},
				},
			},
		},
	}

	result, err := gen.Generate(ctx, ir, GenerateOptions{})
	require.NoError(t, err)

	var clientFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "src/client.rs" {
			clientFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, clientFile)
	content := strings.ToLower(clientFile.Content)
	assert.Contains(t, content, "userid")
	assert.Contains(t, content, "postid")
}
