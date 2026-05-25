//go:build ignore

package tools

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPostmanGenerator(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:        "Test API",
		Description: "Test API for Postman collection",
		Schema:      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		AuthType:    "bearer",
		Environment: map[string]string{
			"baseUrl": "https://api.test.com",
			"apiKey":  "{{apiKey}}",
		},
		Timeout:              30,
		GenerateTests:        true,
		IncludeDocumentation: true,
		IncludeExamples:      true,
	}

	generator := NewPostmanGenerator(spec, config)

	require.NotNil(t, generator)
	assert.Equal(t, spec, generator.spec)
	assert.Equal(t, config.Name, generator.config.Name)
}

func TestPostmanGenerator_Generate(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:          "SDLC.ai API",
		Description:   "Secure Data Learning Platform API",
		Schema:        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		DefaultServer: "https://api.sdlc.cc/v1",
		Servers: []string{
			"https://api.sdlc.cc/v1",
			"https://staging-api.sdlc.cc/v1",
		},
		AuthType: "bearer",
		Environment: map[string]string{
			"baseUrl": "https://api.sdlc.cc/v1",
			"token":   "{{authToken}}",
		},
		GenerateTests:        true,
		IncludeDocumentation: true,
		IncludeExamples:      true,
	}

	generator := NewPostmanGenerator(spec, config)
	require.NotNil(t, generator)

	collection, err := generator.Generate()
	require.NoError(t, err)
	require.NotNil(t, collection)

	// Check collection info
	assert.Equal(t, "SDLC.ai API", collection.Info.Name)
	assert.Equal(t, "Secure Data Learning Platform API", collection.Info.Description)
	assert.Equal(t, "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", collection.Info.Schema)
	assert.NotEmpty(t, collection.Info.ID)

	// Check authentication
	require.NotNil(t, collection.Auth)
	assert.Equal(t, "bearer", collection.Auth.Type)
	require.Len(t, collection.Auth.Bearer, 1)
	assert.Equal(t, "token", collection.Auth.Bearer[0].Key)
	assert.Equal(t, "{{authToken}}", collection.Auth.Bearer[0].Value)

	// Check items (folders and requests)
	require.NotEmpty(t, collection.Item)

	// Find users folder
	var usersFolder *ItemGroup
	for _, item := range collection.Item {
		if folder, ok := item.(map[string]interface{}); ok {
			if name, ok := folder["name"].(string); ok && name == "Users" {
				// Convert to ItemGroup
				folderData, _ := json.Marshal(folder)
				json.Unmarshal(folderData, &usersFolder)
				break
			}
		}
	}

	require.NotNil(t, usersFolder)
	assert.Len(t, usersFolder.Item, 2) // GET and POST users

	// Find auth folder
	var authFolder *ItemGroup
	for _, item := range collection.Item {
		if folder, ok := item.(map[string]interface{}); ok {
			if name, ok := folder["name"].(string); ok && name == "Authentication" {
				folderData, _ := json.Marshal(folder)
				json.Unmarshal(folderData, &authFolder)
				break
			}
		}
	}

	require.NotNil(t, authFolder)
	assert.Len(t, authFolder.Item, 1) // POST auth/login
}

func TestPostmanGenerator_GenerateRequest(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	generator := NewPostmanGenerator(spec, PostmanConfig{})

	// Get the GET /users operation
	usersPath := spec.Paths["/users"]
	getOperation := usersPath.Get

	// Generate request
	request, err := generator.generateRequest("GET /users", getOperation, "https://api.test.com/v1")
	require.NoError(t, err)
	require.NotNil(t, request)

	assert.Equal(t, "GET /users", request.Name)
	assert.Equal(t, "GET", request.Request.Method)
	assert.Equal(t, "https://api.test.com/v1/users", request.Request.URL.Raw)
	assert.Contains(t, request.Request.Description, "Retrieve all users")

	// Check headers
	var headers []PostmanHeader
	for _, h := range request.Request.Header {
		headers = append(headers, h.(PostmanHeader))
	}

	// Should have Content-Type header
	contentTypeFound := false
	for _, h := range headers {
		if h.Key == "Content-Type" && h.Value == "application/json" {
			contentTypeFound = true
			break
		}
	}
	assert.True(t, contentTypeFound, "Content-Type header should be present")

	// Check URL parameters
	assert.NotEmpty(t, request.Request.URL.Query)
	require.Len(t, request.Request.URL.Query, 1)
	assert.Equal(t, "limit", request.Request.URL.Query[0].Key)
	assert.Equal(t, "10", request.Request.URL.Query[0].Value)
	assert.Equal(t, "Maximum number of users to return", request.Request.URL.Query[0].Description)
}

func TestPostmanGenerator_GenerateRequestWithBody(t *testing.T) {
	spec := createTestOpenAPISpecForPostman()
	generator := NewPostmanGenerator(spec, PostmanConfig{})

	// Get the POST /users operation
	usersPath := spec.Paths["/users"]
	postOperation := usersPath.Post

	// Generate request
	request, err := generator.generateRequest("POST /users", postOperation, "https://api.test.com/v1")
	require.NoError(t, err)
	require.NotNil(t, request)

	assert.Equal(t, "POST /users", request.Name)
	assert.Equal(t, "POST", request.Request.Method)
	assert.Equal(t, "https://api.test.com/v1/users", request.Request.URL.Raw)

	// Check body
	require.NotNil(t, request.Request.Body)
	assert.Equal(t, "raw", request.Request.Body.Mode)
	assert.Equal(t, "application/json", request.Request.Body.Options.Raw.Language)

	// Check raw body contains the example
	assert.Contains(t, request.Request.Body.Raw, `"name": "John Doe"`)
	assert.Contains(t, request.Request.Body.Raw, `"email": "john.doe@example.com"`)
}

func TestPostmanGenerator_GenerateTests(t *testing.T) {
	generator := &PostmanGenerator{
		config: PostmanConfig{
			GenerateTests: true,
		},
	}

	tests := generator.generateTests("GET /users")

	require.NotEmpty(t, tests)
	assert.Equal(t, "test", tests[0].Listen)
	require.NotEmpty(t, tests[0].Script.Exec)

	// Check test script content
	script := tests[0].Script.Exec
	assert.Contains(t, script, "pm.test")
	assert.Contains(t, script, "Status code is 200")
	assert.Contains(t, script, "pm.response.to.have.status(200)")
}

func TestPostmanGenerator_GenerateVariables(t *testing.T) {
	config := PostmanConfig{
		Environment: map[string]string{
			"baseUrl": "https://api.sdlc.cc/v1",
			"apiKey":  "{{apiKey}}",
			"token":   "{{authToken}}",
			"tenant":  "demo",
		},
	}

	generator := NewPostmanGenerator(nil, config)
	variables := generator.generateVariables()

	require.Len(t, variables, 4)

	// Find baseUrl variable
	baseUrlFound := false
	for _, v := range variables {
		if v.Key == "baseUrl" {
			assert.Equal(t, "https://api.sdlc.cc/v1", v.Value)
			assert.Equal(t, "string", v.Type)
			baseUrlFound = true
		}
	}
	assert.True(t, baseUrlFound)
}

func TestPostmanGenerator_APIKeyAuth(t *testing.T) {
	config := PostmanConfig{
		AuthType: "apikey",
		APIKey:   "X-API-Key",
	}

	generator := NewPostmanGenerator(nil, config)
	auth := generator.generateAuth()

	require.NotNil(t, auth)
	assert.Equal(t, "apikey", auth.Type)
	require.Len(t, auth.APIKey, 1)
	assert.Equal(t, "X-API-Key", auth.APIKey[0].Key)
	assert.Equal(t, "{{apiKey}}", auth.APIKey[0].Value)
	assert.Equal(t, "header", auth.APIKey[0].In)
}

func TestPostmanGenerator_BasicAuth(t *testing.T) {
	config := PostmanConfig{
		AuthType: "basic",
	}

	generator := NewPostmanGenerator(nil, config)
	auth := generator.generateAuth()

	require.NotNil(t, auth)
	assert.Equal(t, "basic", auth.Type)
	require.Len(t, auth.Basic, 1)
	assert.Equal(t, "{{username}}", auth.Basic[0].Username)
	assert.Equal(t, "{{password}}", auth.Basic[0].Password)
}

func TestPostmanGenerator_SaveCollection(t *testing.T) {
	tempDir := t.TempDir()

	spec := createTestOpenAPISpecForPostman()
	config := PostmanConfig{
		Name:        "Test API",
		Description: "Test API for Postman",
		OutputPath:  tempDir,
		FileName:    "test-collection.json",
	}

	generator := NewPostmanGenerator(spec, config)

	collection, err := generator.Generate()
	require.NoError(t, err)

	err = generator.SaveCollection(collection)
	require.NoError(t, err)

	// Verify file was created and contains valid JSON
	filePath := tempDir + "/test-collection.json"
	data, err := os.ReadFile(filePath)
	require.NoError(t, err)

	var savedCollection PostmanCollection
	err = json.Unmarshal(data, &savedCollection)
	require.NoError(t, err)
	assert.Equal(t, "Test API", savedCollection.Info.Name)
}

func TestPostmanURL_BuildRaw(t *testing.T) {
	tests := []struct {
		name     string
		url      PostmanURL
		expected string
	}{
		{
			name: "Simple URL",
			url: PostmanURL{
				Raw: "https://api.test.com/v1/users",
			},
			expected: "https://api.test.com/v1/users",
		},
		{
			name: "URL with path variables",
			url: PostmanURL{
				Raw: "https://api.test.com/v1/users/{{userId}}",
				Variable: []PostmanURLVariable{
					{Key: "userId", Value: "123"},
				},
			},
			expected: "https://api.test.com/v1/users/123",
		},
		{
			name: "URL with query parameters",
			url: PostmanURL{
				Raw: "https://api.test.com/v1/users",
				Query: []PostmanURLQuery{
					{Key: "limit", Value: "10"},
					{Key: "offset", Value: "0"},
				},
			},
			expected: "https://api.test.com/v1/users?limit=10&offset=0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.url.BuildRaw())
		})
	}
}

// Helper function to create test OpenAPI spec
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
		},
		Paths: openapi3.Paths{
			"/users": &openapi3.PathItem{
				Summary:     "User operations",
				Description: "Operations for managing users",
				Get: &openapi3.Operation{
					OperationID: "getUsers",
					Summary:     "Get all users",
					Description: "Retrieve a list of all users with optional pagination",
					Tags:        []string{"users"},
					Parameters: []*openapi3.ParameterRef{
						{
							Value: &openapi3.Parameter{
								Name:        "limit",
								In:          "query",
								Description: "Maximum number of users to return",
								Required:    false,
								Schema:      openapi3.NewIntegerSchema().WithMin(0).WithMax(100).WithDefault(10),
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
								Examples: map[string]*openapi3Example{
									"users": {
										Summary: "List of users",
										Value: []interface{}{
											map[string]interface{}{
												"id":    "550e8400-e29b-41d4-a716-446655440000",
												"name":  "John Doe",
												"email": "john.doe@example.com",
											},
											map[string]interface{}{
												"id":    "550e8400-e29b-41d4-a716-446655440001",
												"name":  "Jane Smith",
												"email": "jane.smith@example.com",
											},
										},
									},
								},
							},
						},
					},
				},
				Post: &openapi3.Operation{
					OperationID: "createUser",
					Summary:     "Create a user",
					Description: "Create a new user with the provided details",
					Tags:        []string{"users"},
					RequestBody: &openapi3.RequestBodyRef{
						Value: &openapi3.RequestBody{
							Description: "User to create",
							Required:    true,
							Content: openapi3.NewContentWithJSONSchema(&openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"name": {
										Value: openapi3.NewStringSchema().WithMinLength(1).WithMaxLength(100),
									},
									"email": {
										Value: openapi3.NewStringSchema().WithFormat("email"),
									},
								},
								Required: []string{"name", "email"},
							}),
							Examples: map[string]*openapi3Example{
								"user": {
									Summary: "Create a new user",
									Value: map[string]interface{}{
										"name":  "John Doe",
										"email": "john.doe@example.com",
									},
								},
							},
						},
					},
					Responses: openapi3.Responses{
						"201": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "User created successfully",
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
										"created_at": {
											Value: openapi3.NewStringSchema().WithFormat("date-time"),
										},
									},
								}),
							},
						},
					},
				},
			},
			"/auth/login": &openapi3.PathItem{
				Summary:     "Authentication operations",
				Description: "Operations for user authentication",
				Post: &openapi3.Operation{
					OperationID: "login",
					Summary:     "User login",
					Description: "Authenticate user credentials and return a JWT token",
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
		Tags: []openapi3.Tag{
			{
				Name:        "users",
				Description: "User management operations",
			},
			{
				Name:        "auth",
				Description: "Authentication operations",
			},
		},
	}
}

// Helper type for OpenAPI examples
type openapi3Example struct {
	Summary string      `json:"summary,omitempty"`
	Value   interface{} `json:"value"`
}
