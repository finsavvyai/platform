//go:build ignore

package sdk

import (
	"context"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSDKGenerator(t *testing.T) {
	spec := createTestOpenAPISpec()

	tests := []struct {
		name        string
		config      SDKConfig
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid configuration",
			config: SDKConfig{
				Spec:             spec,
				Languages:        []Language{LanguagePython, LanguageTypeScript},
				PackageName:      "test-sdk",
				PackageVersion:   "1.0.0",
				OutputDir:        "./test-output",
				Author:           "Test Author",
				License:          "MIT",
				RepositoryURL:    "https://github.com/test/sdk",
				DocumentationURL: "https://docs.test.com",
			},
			expectError: false,
		},
		{
			name: "Missing spec",
			config: SDKConfig{
				Languages: []Language{LanguagePython},
			},
			expectError: true,
			errorMsg:    "OpenAPI specification is required",
		},
		{
			name: "Defaults applied",
			config: SDKConfig{
				Spec:      spec,
				Languages: []Language{LanguagePython},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			generator, err := NewSDKGenerator(tt.config, nil)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, generator)
			} else {
				require.NoError(t, err)
				require.NotNil(t, generator)

				// Check defaults were applied
				assert.Equal(t, "sdlc-ai-sdk", generator.config.PackageName)
				assert.Equal(t, "1.0.0", generator.config.PackageVersion)
				assert.Equal(t, "MIT", generator.config.License)
				assert.Equal(t, "./generated-sdks", generator.config.OutputDir)
			}
		})
	}
}

func TestSDKGenerator_GenerateAll(t *testing.T) {
	spec := createTestOpenAPISpec()
	config := SDKConfig{
		Spec:           spec,
		Languages:      []Language{LanguagePython, LanguageTypeScript, LanguageGo},
		PackageName:    "test-sdk",
		PackageVersion: "1.0.0",
		OutputDir:      "./test-output",
		Author:         "Test Author",
		License:        "MIT",
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	results, err := generator.GenerateAll(ctx)

	require.NoError(t, err)
	assert.Len(t, results, 3)

	// Check Python SDK
	pythonSDK, ok := results[LanguagePython]
	require.True(t, ok)
	assert.Equal(t, LanguagePython, pythonSDK.Language)
	assert.Equal(t, "test-sdk", pythonSDK.PackageName)
	assert.Equal(t, "1.0.0", pythonSDK.Version)
	assert.NotEmpty(t, pythonSDK.Files)
	assert.NotEmpty(t, pythonSDK.Dependencies)
	assert.NotEmpty(t, pythonSDK.Readme)

	// Check TypeScript SDK
	tsSDK, ok := results[LanguageTypeScript]
	require.True(t, ok)
	assert.Equal(t, LanguageTypeScript, tsSDK.Language)
	assert.Equal(t, "test-sdk", tsSDK.PackageName)
	assert.Equal(t, "1.0.0", tsSDK.Version)

	// Check Go SDK
	goSDK, ok := results[LanguageGo]
	require.True(t, ok)
	assert.Equal(t, LanguageGo, goSDK.Language)
	assert.Equal(t, "test-sdk", goSDK.PackageName)
	assert.Equal(t, "1.0.0", goSDK.Version)
}

func TestSDKGenerator_GeneratePythonSDK(t *testing.T) {
	spec := createTestOpenAPISpec()
	config := SDKConfig{
		Spec:           spec,
		PackageName:    "sdlc-ai",
		PackageVersion: "1.0.0",
		Author:         "Test Author",
		License:        "MIT",
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	sdk, err := generator.GenerateForLanguage(ctx, LanguagePython)

	require.NoError(t, err)
	assert.Equal(t, LanguagePython, sdk.Language)
	assert.Equal(t, "sdlc-ai", sdk.PackageName)
	assert.Equal(t, "1.0.0", sdk.Version)

	// Check required files
	requiredFiles := []string{
		"__init__.py",
		"client.py",
		"auth.py",
		"exceptions.py",
		"models.py",
		"requirements.txt",
		"setup.py",
		"README.md",
		"LICENSE",
	}

	for _, file := range requiredFiles {
		_, exists := sdk.Files[file]
		assert.True(t, exists, "Missing required file: %s", file)
	}

	// Check dependencies
	assert.Contains(t, sdk.Dependencies, "requests>=2.31.0")
	assert.Contains(t, sdk.Dependencies, "pydantic>=2.0.0")

	// Check README content
	assert.Contains(t, sdk.Readme, "# sdlc-ai")
	assert.Contains(t, sdk.Readme, "Test Author")
	assert.Contains(t, sdk.Readme, "MIT License")

	// Check examples
	assert.NotEmpty(t, sdk.Examples)
	assert.Contains(t, sdk.Examples[0], "from sdlc_ai import")
}

func TestSDKGenerator_GenerateTypeScriptSDK(t *testing.T) {
	spec := createTestOpenAPISpec()
	config := SDKConfig{
		Spec:           spec,
		PackageName:    "@sdlc-ai/sdk",
		PackageVersion: "1.0.0",
		Author:         "Test Author",
		License:        "MIT",
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	sdk, err := generator.GenerateForLanguage(ctx, LanguageTypeScript)

	require.NoError(t, err)
	assert.Equal(t, LanguageTypeScript, sdk.Language)
	assert.Equal(t, "@sdlc-ai/sdk", sdk.PackageName)
	assert.Equal(t, "1.0.0", sdk.Version)

	// Check required files
	requiredFiles := []string{
		"package.json",
		"tsconfig.json",
		"src/index.ts",
		"src/client.ts",
		"src/auth.ts",
		"src/types.ts",
		"src/errors.ts",
		"README.md",
		".npmignore",
	}

	for _, file := range requiredFiles {
		_, exists := sdk.Files[file]
		assert.True(t, exists, "Missing required file: %s", file)
	}

	// Check package.json
	packageJSON, exists := sdk.Files["package.json"]
	require.True(t, exists)
	assert.Contains(t, packageJSON, `"name": "@sdlc-ai/sdk"`)
	assert.Contains(t, packageJSON, `"version": "1.0.0"`)
	assert.Contains(t, packageJSON, `"main": "dist/index.js"`)
	assert.Contains(t, packageJSON, `"types": "dist/index.d.ts"`)

	// Check dependencies
	assert.Contains(t, sdk.Dependencies, "axios")
	assert.Contains(t, sdk.Dependencies, "typescript")
}

func TestSDKGenerator_GenerateGoSDK(t *testing.T) {
	spec := createTestOpenAPISpec()
	config := SDKConfig{
		Spec:           spec,
		PackageName:    "github.com/sdlc-ai/go-sdk",
		PackageVersion: "1.0.0",
		Author:         "Test Author",
		License:        "MIT",
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	sdk, err := generator.GenerateForLanguage(ctx, LanguageGo)

	require.NoError(t, err)
	assert.Equal(t, LanguageGo, sdk.Language)
	assert.Equal(t, "github.com/sdlc-ai/go-sdk", sdk.PackageName)
	assert.Equal(t, "1.0.0", sdk.Version)

	// Check required files
	requiredFiles := []string{
		"go.mod",
		"client.go",
		"auth.go",
		"models.go",
		"requests.go",
		"responses.go",
		"README.md",
		"LICENSE",
	}

	for _, file := range requiredFiles {
		_, exists := sdk.Files[file]
		assert.True(t, exists, "Missing required file: %s", file)
	}

	// Check go.mod
	goMod, exists := sdk.Files["go.mod"]
	require.True(t, exists)
	assert.Contains(t, goMod, "module github.com/sdlc-ai/go-sdk")
	assert.Contains(t, goMod, "go 1.21")

	// Check client.go
	clientGo, exists := sdk.Files["client.go"]
	require.True(t, exists)
	assert.Contains(t, clientGo, "package sdk")
	assert.Contains(t, clientGo, "type Client struct")
	assert.Contains(t, clientGo, "func NewClient(")
}

func TestSDKGenerator_CustomGenerator(t *testing.T) {
	spec := createTestOpenAPISpec()

	// Create a custom generator
	customGen := &mockCustomGenerator{
		language: LanguageRuby,
		sdk: &GeneratedSDK{
			Language:     LanguageRuby,
			PackageName:  "custom-sdk",
			Version:      "1.0.0",
			Files:        map[string]string{"custom.rb": "# Custom SDK"},
			Dependencies: []string{"custom-gem"},
		},
	}

	config := SDKConfig{
		Spec:             spec,
		Languages:        []Language{LanguageRuby},
		PackageName:      "test-sdk",
		CustomGenerators: map[Language]CodeGenerator{LanguageRuby: customGen},
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	sdk, err := generator.GenerateForLanguage(ctx, LanguageRuby)

	require.NoError(t, err)
	assert.Equal(t, LanguageRuby, sdk.Language)
	assert.Equal(t, "custom-sdk", sdk.PackageName)
	assert.Contains(t, sdk.Files, "custom.rb")
}

func TestSDKGenerator_UnsupportedLanguage(t *testing.T) {
	spec := createTestOpenAPISpec()
	config := SDKConfig{
		Spec:      spec,
		Languages: []Language{Language("invalid")},
	}

	generator, err := NewSDKGenerator(config, nil)
	require.NoError(t, err)

	ctx := context.Background()
	_, err = generator.GenerateForLanguage(ctx, Language("invalid"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported language")
}

// Helper functions and mock implementations

func createTestOpenAPISpec() *openapi3.T {
	return &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:          "Test API",
			Description:    "A test API for SDK generation",
			Version:        "1.0.0",
			TermsOfService: "https://test.com/terms",
			Contact: &openapi3.Contact{
				Name:  "API Support",
				Email: "support@test.com",
				URL:   "https://test.com/support",
			},
			License: &openapi3.License{
				Name: "MIT",
				URL:  "https://opensource.org/licenses/MIT",
			},
		},
		Servers: []*openapi3.Server{
			{
				URL:         "https://api.test.com/v1",
				Description: "Production server",
			},
		},
		Paths: openapi3.Paths{
			"/users": &openapi3.PathItem{
				Get: &openapi3.Operation{
					OperationID: "getUsers",
					Summary:     "Get all users",
					Description: "Retrieve a list of all users",
					Tags:        []string{"users"},
					Parameters: []*openapi3.ParameterRef{
						{
							Value: &openapi3.Parameter{
								Name:            "limit",
								In:              "query",
								Description:     "Maximum number of users to return",
								Required:        false,
								Schema:          openapi3.NewIntegerSchema().WithMin(0).WithMax(100),
								AllowEmptyValue: false,
							},
						},
					},
					Responses: openapi3.Responses{
						"200": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "A list of users",
								Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Value: &openapi3.Schema{
											Type: "object",
											Properties: map[string]*openapi3.SchemaRef{
												"id": {
													Value: openapi3.NewStringSchema().WithFormat("uuid"),
												},
												"name": {
													Value: openapi3.NewStringSchema(),
												},
												"email": {
													Value: openapi3.NewStringSchema().WithFormat("email"),
												},
											},
										},
									},
								}),
							},
						},
					},
				},
				Post: &openapi3.Operation{
					OperationID: "createUser",
					Summary:     "Create a user",
					Description: "Create a new user",
					Tags:        []string{"users"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "User to create",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"name": {
										Value: openapi3.NewStringSchema(),
									},
									"email": {
										Value: openapi3.NewStringSchema().WithFormat("email"),
									},
								},
								Required: []string{"name", "email"},
							}),
						},
					},
					Responses: openapi3.Responses{
						"201": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "User created",
								Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
									Type: "object",
									Properties: map[string]*openapi3.SchemaRef{
										"id": {
											Value: openapi3.NewStringSchema().WithFormat("uuid"),
										},
										"name": {
											Value: openapi3.NewStringSchema(),
										},
										"email": {
											Value: openapi3.NewStringSchema().WithFormat("email"),
										},
									},
								}),
							},
						},
					},
				},
			},
			"/auth/login": &openapi3.PathItem{
				Post: &openapi3.Operation{
					OperationID: "login",
					Summary:     "User login",
					Description: "Authenticate user and return token",
					Tags:        []string{"auth"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "Login credentials",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"email": {
										Value: openapi3.NewStringSchema().WithFormat("email"),
									},
									"password": {
										Value: openapi3.NewStringSchema().WithMinLength(8),
									},
								},
								Required: []string{"email", "password"},
							}),
						},
					},
					Responses: openapi3.Responses{
						"200": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "Login successful",
								Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
									Type: "object",
									Properties: map[string]*openapi3.SchemaRef{
										"token": {
											Value: openapi3.NewStringSchema(),
										},
										"expires_in": {
											Value: openapi3.NewIntegerSchema(),
										},
									},
								}),
							},
						},
					},
				},
			},
		},
		Components: &openapi3.Components{
			SecuritySchemes: map[string]*openapi3.SecuritySchemeRef{
				"BearerAuth": {
					Value: &openapi3.SecurityScheme{
						Type:         "http",
						Scheme:       "bearer",
						BearerFormat: "JWT",
						Description:  "JWT authentication token",
					},
				},
			},
		},
		Security: []openapi3.SecurityRequirement{
			{"BearerAuth": {}},
		},
	}
}

// Mock custom generator for testing
type mockCustomGenerator struct {
	language Language
	sdk      *GeneratedSDK
}

func (m *mockCustomGenerator) Generate(ctx context.Context, config SDKConfig, lang Language) (*GeneratedSDK, error) {
	if lang != m.language {
		return nil, nil
	}
	return m.sdk, nil
}

func (m *mockCustomGenerator) Validate() error {
	if m.sdk == nil {
		return nil
	}
	return nil
}
