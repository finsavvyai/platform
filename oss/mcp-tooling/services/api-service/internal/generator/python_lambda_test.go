package generator

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPythonLambdaGenerator(t *testing.T) {
	gen := NewPythonLambdaGenerator()

	assert.NotNil(t, gen)
	assert.Equal(t, "python", gen.GetLanguage())
	assert.Equal(t, "aws-lambda", gen.GetRuntime())
	assert.Equal(t, "1.0.0", gen.GetVersion())

	// Check features
	features := gen.GetSupportedFeatures()
	assert.Contains(t, features, FeatureBasicGeneration)
	assert.Contains(t, features, FeatureTypeGeneration)
	assert.Contains(t, features, FeatureAuthGeneration)
	assert.Contains(t, features, FeatureAWSLambda)
}

func TestPythonLambdaGenerator_Generate(t *testing.T) {
	gen := NewPythonLambdaGenerator()
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
		Language:     "python",
		Runtime:      "aws-lambda",
		PackageName:  "test-api",
		IncludeTests: true,
		IncludeDocs:  true,
	}

	result, err := gen.Generate(ctx, ir, opts)
	require.NoError(t, err)
	assert.NotNil(t, result)

	// Check metadata
	assert.Equal(t, "python", result.Language)
	assert.Equal(t, "aws-lambda", result.Runtime)
	assert.Greater(t, len(result.Files), 0)

	// Check generated files
	fileTypes := make(map[string]bool)
	for _, file := range result.Files {
		fileTypes[file.Path] = true
	}

	assert.True(t, fileTypes["handler.py"])
	assert.True(t, fileTypes["models.py"])
	assert.True(t, fileTypes["tools.py"])
	assert.True(t, fileTypes["client.py"])
	assert.True(t, fileTypes["requirements.txt"])
	assert.True(t, fileTypes["template.yaml"])
	assert.True(t, fileTypes["README.md"])
	assert.True(t, fileTypes["test_handler.py"])
}

func TestPythonLambdaGenerator_GenerateHandlerFile(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	file, err := gen.generateHandlerFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "handler.py", file.Path)
	assert.Equal(t, FileTypeSource, file.Type)
	assert.Equal(t, "python", file.Language)
	assert.Contains(t, file.Content, "def lambda_handler")
	assert.Contains(t, file.Content, "/.well-known/mcp.json")
	assert.Contains(t, file.Content, "/mcp/execute")
	assert.Contains(t, file.Content, "execute_tool")
	assert.Contains(t, file.Content, "import json")
	assert.Contains(t, file.Content, "import logging")
}

func TestPythonLambdaGenerator_GenerateModelsFile(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	file, err := gen.generateModelsFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "models.py", file.Path)
	assert.Contains(t, file.Content, "from typing import TypedDict")
	assert.Contains(t, file.Content, "class User(TypedDict)")
	assert.Contains(t, file.Content, "id: str")
	assert.Contains(t, file.Content, "name: Optional[str]")
}

func TestPythonLambdaGenerator_GenerateToolsFile(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	assert.Equal(t, "tools.py", file.Path)
	assert.Contains(t, file.Content, "def get_tools()")
	assert.Contains(t, file.Content, "'name': 'get_user'")
	assert.Contains(t, file.Content, "'description': 'Fetch user by ID'")
	assert.Contains(t, file.Content, "'properties':")
	assert.Contains(t, file.Content, "'id':")
	assert.Contains(t, file.Content, "'required': ['id']")
}

func TestPythonLambdaGenerator_GenerateClientFile(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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
					},
					{
						Name: "fields",
						In:   "query",
					},
				},
			},
		},
		Auth: []parser.AuthScheme{},
	}

	file, err := gen.generateClientFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "client.py", file.Path)
	assert.Contains(t, file.Content, "class APIClient:")
	assert.Contains(t, file.Content, "def __init__")
	assert.Contains(t, file.Content, "def get_user")
	assert.Contains(t, file.Content, "import requests")
	assert.Contains(t, file.Content, "self.session.get")
}

func TestPythonLambdaGenerator_GenerateRequirements(t *testing.T) {
	gen := NewPythonLambdaGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "test-api",
		},
	}

	file, err := gen.generateRequirements(ir, GenerateOptions{
		IncludeTests: true,
	})
	require.NoError(t, err)

	assert.Equal(t, "requirements.txt", file.Path)
	assert.Equal(t, FileTypeConfig, file.Type)
	assert.Contains(t, file.Content, "requests>=2.31.0")
	assert.Contains(t, file.Content, "boto3>=1.28.0")
	assert.Contains(t, file.Content, "pytest>=7.4.0")
}

func TestPythonLambdaGenerator_GenerateSAMTemplate(t *testing.T) {
	gen := NewPythonLambdaGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Title:       "Test API",
			Description: "A test API",
		},
		Servers: []parser.ServerConfig{
			{URL: "https://api.example.com"},
		},
	}

	file, err := gen.generateSAMTemplate(ir, GenerateOptions{
		PackageName: "my-function",
	})
	require.NoError(t, err)

	assert.Equal(t, "template.yaml", file.Path)
	assert.Equal(t, FileTypeConfig, file.Type)
	assert.Contains(t, file.Content, "AWSTemplateFormatVersion")
	assert.Contains(t, file.Content, "AWS::Serverless-2016-10-31")
	assert.Contains(t, file.Content, "Handler: handler.lambda_handler")
	assert.Contains(t, file.Content, "Runtime: python3.11")
	assert.Contains(t, file.Content, "/.well-known/mcp.json")
	assert.Contains(t, file.Content, "/mcp/execute")
}

func TestPythonLambdaGenerator_GenerateReadme(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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
	assert.Contains(t, file.Content, "## Deployment")
	assert.Contains(t, file.Content, "sam build")
	assert.Contains(t, file.Content, "### get_user")
}

func TestPythonLambdaGenerator_GenerateTestFile(t *testing.T) {
	gen := NewPythonLambdaGenerator()

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name: "Test API",
		},
	}

	file, err := gen.generateTestFile(ir, GenerateOptions{})
	require.NoError(t, err)

	assert.Equal(t, "test_handler.py", file.Path)
	assert.Equal(t, FileTypeTest, file.Type)
	assert.Contains(t, file.Content, "import pytest")
	assert.Contains(t, file.Content, "def test_mcp_manifest")
	assert.Contains(t, file.Content, "def test_cors_preflight")
}

func TestPythonLambdaGenerator_GetToolName(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

func TestPythonLambdaGenerator_GenerateTypeDefinition(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	assert.Contains(t, result, "class User(TypedDict)")
	assert.Contains(t, result, "id: str")
	assert.Contains(t, result, "email: str")
	assert.Contains(t, result, "age: Optional[int]") // Optional field
}

func TestPythonLambdaGenerator_GenerateClientMethod(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	result := gen.generateClientMethod(endpoint, ir)

	assert.Contains(t, result, "def get_user(self, **kwargs)")
	assert.Contains(t, result, "id = kwargs.get('id')")
	assert.Contains(t, result, "if 'fields' in kwargs:")
	assert.Contains(t, result, "self.session.get(")
	assert.Contains(t, result, "response.json()")
}

func TestPythonLambdaGenerator_GenerateDependencies(t *testing.T) {
	gen := NewPythonLambdaGenerator()

	ir := &parser.IntermediateRepresentation{}

	deps := gen.generateDependencies(ir, GenerateOptions{
		IncludeTests: true,
	})

	assert.GreaterOrEqual(t, len(deps), 3)

	// Check for required dependencies
	foundRequests := false
	foundBoto3 := false
	foundPytest := false

	for _, dep := range deps {
		if dep.Name == "requests" {
			foundRequests = true
			assert.Equal(t, DependencyTypeRuntime, dep.Type)
			assert.True(t, dep.Required)
		}
		if dep.Name == "boto3" {
			foundBoto3 = true
		}
		if dep.Name == "pytest" {
			foundPytest = true
			assert.Equal(t, DependencyTypeDev, dep.Type)
		}
	}

	assert.True(t, foundRequests)
	assert.True(t, foundBoto3)
	assert.True(t, foundPytest)
}

func TestPythonLambdaGenerator_WithAuthentication(t *testing.T) {
	gen := NewPythonLambdaGenerator()
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

	// Find handler file
	var handlerFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "handler.py" {
			handlerFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, handlerFile)
	assert.Contains(t, handlerFile.Content, "API_KEY")
	assert.Contains(t, handlerFile.Content, "api_key")

	// Find client file
	var clientFile *GeneratedFile
	for i := range result.Files {
		if result.Files[i].Path == "client.py" {
			clientFile = &result.Files[i]
			break
		}
	}

	require.NotNil(t, clientFile)
	assert.Contains(t, clientFile.Content, "Authorization")
}

func TestPythonLambdaGenerator_ComplexEndpoint(t *testing.T) {
	gen := NewPythonLambdaGenerator()

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

	result := gen.generateClientMethod(endpoint, ir)

	assert.Contains(t, result, "def create_user(self, **kwargs)")
	assert.Contains(t, result, "self.session.post(")
	assert.Contains(t, result, "json=kwargs.get('body')")
	assert.Contains(t, result, "if 'apiVersion' in kwargs:")
}

func TestPythonLambdaGenerator_Statistics(t *testing.T) {
	gen := NewPythonLambdaGenerator()
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
