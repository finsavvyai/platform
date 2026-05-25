//go:build ignore

package tools

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPostmanGenerator(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()

	tests := []struct {
		name        string
		config      PostmanConfig
		expectError bool
	}{
		{
			name: "Valid configuration",
			config: PostmanConfig{
				Name:        "Test API",
				Description: "Test API collection",
				AuthType:    "bearer",
				OutputPath:  "./test-output",
				FileName:    "test-collection.json",
			},
			expectError: false,
		},
		{
			name: "Missing name",
			config: PostmanConfig{
				Description: "Test API collection",
				AuthType:    "bearer",
			},
			expectError: false, // Should use defaults
		},
		{
			name: "API Key auth",
			config: PostmanConfig{
				Name:     "Test API",
				AuthType: "apikey",
				APIKey:   "test-api-key",
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			generator, err := NewPostmanGenerator(spec, tt.config)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, generator)
			} else {
				require.NoError(t, err)
				require.NotNil(t, generator)

				// Check defaults were applied
				if tt.config.Name == "" {
					assert.Equal(t, "API Collection", generator.config.Name)
				}
				if tt.config.FileName == "" {
					assert.Equal(t, "collection.json", generator.config.FileName)
				}
			}
		})
	}
}

func TestPostmanGenerator_Generate(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:        "Test API Collection",
		Description: "A comprehensive test API collection",
		Schema:      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		AuthType:    "bearer",
		Bearer:      "test-bearer-token",
		OutputPath:  "./test-output",
		FileName:    "test-collection.json",
		Environment: map[string]string{
			"baseUrl": "https://api.test.com/v1",
			"apiKey":  "{{apiKey}}",
		},
		GenerateTests: true,
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Verify collection info
	assert.Equal(t, "Test API Collection", collection.Info.Name)
	assert.Equal(t, "A comprehensive test API collection", collection.Info.Description)
	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", collection.Info.Schema)

	// Verify authentication
	require.NotNil(t, collection.Auth)
	assert.Equal(t, "bearer", collection.Auth.Type)
	require.Len(t, collection.Auth.Bearer, 1)
	assert.Equal(t, "token", collection.Auth.Bearer[0].Key)
	assert.Equal(t, "test-bearer-token", collection.Auth.Bearer[0].Value)

	// Verify items (folders/requests)
	require.NotEmpty(t, collection.Item)

	// Find the users folder
	var usersFolder *ItemGroup
	for _, item := range collection.Item {
		if folder, ok := item.(map[string]interface{}); ok {
			if name, ok := folder["name"].(string); ok && name == "Users" {
				// Convert to ItemGroup
				folderBytes, _ := json.Marshal(folder)
				json.Unmarshal(folderBytes, &usersFolder)
				break
			}
		}
	}

	require.NotNil(t, usersFolder)
	require.Len(t, usersFolder.Item, 2) // GET and POST /users

	// Verify GET /users request
	var getUsersRequest *Item
	for _, item := range usersFolder.Item {
		if req, ok := item.(map[string]interface{}); ok {
			if name, ok := req["name"].(string); ok && name == "Get All Users" {
				reqBytes, _ := json.Marshal(req)
				json.Unmarshal(reqBytes, &getUsersRequest)
				break
			}
		}
	}

	require.NotNil(t, getUsersRequest)
	assert.Equal(t, "GET", getUsersRequest.Request.Method)
	assert.Equal("{{baseUrl}}/users", getUsersRequest.Request.URL.Raw)
	assert.Contains(t, getUsersRequest.Request.Description, "Retrieve a list of all users")

	// Verify query parameters
	require.NotNil(t, getUsersRequest.Request.URL.Query)
	require.Len(t, getUsersRequest.Request.URL.Query, 1)
	assert.Equal(t, "limit", getUsersRequest.Request.URL.Query[0].Key)
	assert.Equal(t, "50", getUsersRequest.Request.URL.Query[0].Value)

	// Verify headers
	var authHeader *PostmanHeader
	for _, header := range getUsersRequest.Request.Header {
		if header.Key == "Authorization" {
			authHeader = &header
			break
		}
	}
	require.NotNil(t, authHeader)
	assert.Equal(t, "Bearer {{bearerToken}}", authHeader.Value)

	// Verify test scripts
	if config.GenerateTests {
		require.NotEmpty(t, getUsersRequest.Event)
		var testScript *PostmanScript
		for _, event := range getUsersRequest.Event {
			if event.Listen == "test" {
				testScript = &event.Script
				break
			}
		}
		require.NotNil(t, testScript)
		assert.NotEmpty(t, testScript.Exec)
	}
}

func TestPostmanGenerator_GenerateWithAPIKeyAuth(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:       "Test API",
		AuthType:   "apikey",
		APIKey:     "test-api-key",
		OutputPath: "./test-output",
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Verify API key authentication
	require.NotNil(t, collection.Auth)
	assert.Equal(t, "apikey", collection.Auth.Type)
	require.Len(t, collection.Auth.APIKey, 1)
	assert.Equal(t, "X-API-Key", collection.Auth.APIKey[0].Key)
	assert.Equal(t, "{{apiKey}}", collection.Auth.APIKey[0].Value)
	assert.Equal(t, "header", collection.Auth.APIKey[0].In)
}

func TestPostmanGenerator_GenerateWithBasicAuth(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:       "Test API",
		AuthType:   "basic",
		OutputPath: "./test-output",
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Verify basic authentication
	require.NotNil(t, collection.Auth)
	assert.Equal(t, "basic", collection.Auth.Type)
	require.Len(t, collection.Auth.Basic, 1)
	assert.Equal(t, "{{username}}", collection.Auth.Basic[0].Username)
	assert.Equal(t, "{{password}}", collection.Auth.Basic[0].Password)
}

func TestPostmanGenerator_SaveToFile(t *testing.T) {
	tempDir := t.TempDir()
	config := PostmanConfig{
		Name:        "Test API Collection",
		Description: "Test collection",
		AuthType:    "bearer",
		OutputPath:  tempDir,
		FileName:    "test-collection.json",
	}

	spec := createTestOpenAPISpecForPostman()
	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Save to file
	err = generator.SaveToFile(collection)
	require.NoError(t, err)

	// Verify file was created
	filePath := filepath.Join(tempDir, "test-collection.json")
	_, err = os.Stat(filePath)
	assert.NoError(t, err)

	// Verify file content
	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	var savedCollection PostmanCollection
	err = json.Unmarshal(data, &savedCollection)
	require.NoError(t, err)

	assert.Equal(t, collection.Info.Name, savedCollection.Info.Name)
	assert.Equal(t, collection.Info.Description, savedCollection.Info.Description)
}

func TestPostmanGenerator_GenerateEnvironmentFile(t *testing.T) {
	tempDir := t.TempDir()
	config := PostmanConfig{
		Name:       "Test API",
		OutputPath: tempDir,
		Environment: map[string]string{
			"baseUrl":     "https://api.test.com/v1",
			"apiKey":      "",
			"bearerToken": "",
			"username":    "",
			"password":    "",
		},
	}

	spec := createTestOpenAPISpecForPostman()
	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	// Generate environment file
	err = generator.GenerateEnvironmentFile()
	require.NoError(t, err)

	// Verify file was created
	filePath := filepath.Join(tempDir, "environment.json")
	_, err = os.Stat(filePath)
	assert.NoError(t, err)

	// Verify file content
	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	var environment map[string]interface{}
	err = json.Unmarshal(data, &environment)
	require.NoError(t, err)

	assert.Equal(t, "Test API Environment", environment["name"])

	values, ok := environment["values"].([]interface{})
	require.True(t, ok)
	require.Len(t, values, 5)
}

func TestPostmanGenerator_WithServers(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:          "Test API",
		AuthType:      "bearer",
		DefaultServer: "https://api.test.com/v1",
		Servers:       []string{"https://staging-api.test.com/v1", "https://dev-api.test.com/v1"},
		OutputPath:    "./test-output",
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Verify server variables
	require.NotNil(t, collection.Variable)

	// Find baseUrl variable
	var baseUrlVar *PostmanVariable
	for _, variable := range collection.Variable {
		if variable.Key == "baseUrl" {
			baseUrlVar = &variable
			break
		}
	}

	require.NotNil(t, baseUrlVar)
	assert.Equal(t, "string", baseUrlVar.Type)
}

func TestPostmanGenerator_ComplexRequestBody(t *testing.T) {
	// Create a spec with complex request body
	spec := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   "Complex API",
			Version: "1.0.0",
		},
		Paths: openapi3.Paths{
			"/users": &openapi3.PathItem{
				Post: &openapi3.Operation{
					OperationID: "createUser",
					Summary:     "Create user",
					Tags:        []string{"users"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "User object",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"name": {
										Value: &openapi3.Schema{
											Type:        "string",
											Description: "User name",
											Example:     "John Doe",
										},
									},
									"email": {
										Value: &openapi3.Schema{
											Type:        "string",
											Format:      "email",
											Description: "User email",
											Example:     "john@example.com",
										},
									},
									"address": {
										Value: &openapi3.Schema{
											Type: "object",
											Properties: map[string]*openapi3.SchemaRef{
												"street": {
													Value: &openapi3.Schema{
														Type:        "string",
														Description: "Street address",
														Example:     "123 Main St",
													},
												},
												"city": {
													Value: &openapi3.Schema{
														Type:        "string",
														Description: "City",
														Example:     "New York",
													},
												},
											},
										},
									},
								},
								Required: []string{"name", "email"},
							}),
						},
					},
					Responses: openapi3.Responses{
						"201": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "Created",
							},
						},
					},
				},
			},
		},
	}

	config := PostmanConfig{
		Name:       "Complex API",
		AuthType:   "bearer",
		OutputPath: "./test-output",
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(t, err)

	collection, err := generator.Generate()
	require.NoError(t, err)

	// Find the POST users request
	var postUsersRequest *Item
	for _, item := range collection.Item {
		if folder, ok := item.(map[string]interface{}); ok {
			if name, ok := folder["name"].(string); ok && name == "Users" {
				folderBytes, _ := json.Marshal(folder)
				var usersFolder ItemGroup
				json.Unmarshal(folderBytes, &usersFolder)

				for _, req := range usersFolder.Item {
					if req.Name == "Create User" {
						postUsersRequest = &req
						break
					}
				}
			}
		}
	}

	require.NotNil(t, postUsersRequest)
	require.NotNil(t, postUsersRequest.Request.Body)

	// Verify body mode
	assert.Equal(t, "raw", postUsersRequest.Request.Body.Mode)
	assert.Equal(t, "application/json", postUsersRequest.Request.Body.Options.Raw.Language)

	// Verify body example
	var bodyExample map[string]interface{}
	err = json.Unmarshal([]byte(postUsersRequest.Request.Body.Raw.(string)), &bodyExample)
	require.NoError(t, err)

	assert.Equal(t, "John Doe", bodyExample["name"])
	assert.Equal(t, "john@example.com", bodyExample["email"])
}

func BenchmarkPostmanGenerator_Generate(b *testing.B) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:        "Benchmark API",
		Description: "API for benchmarking",
		AuthType:    "bearer",
		OutputPath:  "./test-output",
	}

	generator, err := NewPostmanGenerator(spec, config)
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := generator.Generate()
		require.NoError(b, err)
	}
}

// Helper functions

func createTestOpenAPISpecForPostman() *openapi3.T {
	return &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:          "Test API",
			Description:    "A test API for Postman collection generation",
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
			{
				URL:         "https://staging-api.test.com/v1",
				Description: "Staging server",
			},
		},
		Paths: openapi3.Paths{
			"/users": &openapi3.PathItem{
				Get: &openapi3.Operation{
					OperationID: "getUsers",
					Summary:     "Get all users",
					Description: "Retrieve a list of all users with optional filtering",
					Tags:        []string{"users"},
					Parameters: []*openapi3.ParameterRef{
						{
							Value: &openapi3.Parameter{
								Name:        "limit",
								In:          "query",
								Description: "Maximum number of users to return",
								Required:    false,
								Schema:      openapi3.NewIntegerSchema().WithMin(0).WithMax(100).WithDefault(50),
							},
						},
						{
							Value: &openapi3.Parameter{
								Name:        "offset",
								In:          "query",
								Description: "Number of users to skip",
								Required:    false,
								Schema:      openapi3.NewIntegerSchema().WithMin(0).WithDefault(0),
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
												"created_at": {
													Value: openapi3.NewStringSchema().WithFormat("date-time"),
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
					Description: "Create a new user account",
					Tags:        []string{"users"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "User object",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"name": {
										Value: &openapi3.Schema{
											Type:        "string",
											Description: "User full name",
											Example:     "John Doe",
										},
									},
									"email": {
										Value: &openapi3.Schema{
											Type:        "string",
											Format:      "email",
											Description: "User email address",
											Example:     "john@example.com",
										},
									},
								},
								Required: []string{"name", "email"},
							}),
						},
					},
					Responses: openapi3.Responses{
						"201": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "User created successfully",
							},
						},
					},
				},
			},
			"/auth/login": &openapi3.PathItem{
				Post: &openapi3.Operation{
					OperationID: "login",
					Summary:     "User login",
					Description: "Authenticate user credentials",
					Tags:        []string{"authentication"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "Login credentials",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"email": {
										Value: &openapi3.NewStringSchema().WithFormat("email"),
									},
									"password": {
										Value: &openapi3.NewStringSchema().WithMinLength(8),
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
