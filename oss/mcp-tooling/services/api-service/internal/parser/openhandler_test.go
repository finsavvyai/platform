package parser

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenHandlerParser_DetectFormat(t *testing.T) {
	parser := NewOpenHandlerParser()

	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{
			name: "OpenHandler 1.0.0",
			input: `{
				"openhandler": "1.0.0",
				"info": {"title": "Test API", "version": "1.0.0"}
			}`,
			want:    "openhandler",
			wantErr: false,
		},
		{
			name: "OpenHandler without version",
			input: `{
				"info": {"title": "Test API", "version": "1.0.0"},
				"handlers": {
					"getUser": {
						"method": "GET",
						"path": "/users/{id}"
					}
				}
			}`,
			want:    "openhandler",
			wantErr: false,
		},
		{
			name: "Invalid JSON",
			input: `{
				"openapi": "3.0.0"
			}`,
			want:    "",
			wantErr: true,
		},
		{
			name:    "Not JSON",
			input:   `not json`,
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parser.DetectFormat([]byte(tt.input))
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestOpenHandlerParser_Parse_SimpleAPI(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "User Management API",
			"version": "1.0.0",
			"description": "API for managing users"
		},
		"servers": [
			{
				"url": "https://api.example.com",
				"description": "Production server"
			}
		],
		"handlers": {
			"getUser": {
				"summary": "Get user by ID",
				"description": "Retrieve a user by their unique identifier",
				"method": "GET",
				"path": "/users/{id}",
				"parameters": [
					{
						"name": "id",
						"in": "path",
						"description": "User ID",
						"required": true,
						"schema": {"type": "string"}
					}
				],
				"responses": {
					"200": {
						"description": "Successful response",
						"content": {
							"application/json": {
								"schema": {
									"type": "object",
									"properties": {
										"id": {"type": "string"},
										"name": {"type": "string"},
										"email": {"type": "string"}
									}
								}
							}
						}
					}
				}
			},
			"createUser": {
				"summary": "Create new user",
				"method": "POST",
				"path": "/users",
				"requestBody": {
					"description": "User data",
					"required": true,
					"content": {
						"application/json": {
							"schema": {
								"type": "object",
								"properties": {
									"name": {"type": "string"},
									"email": {"type": "string"}
								}
							}
						}
					}
				},
				"responses": {
					"201": {
						"description": "User created"
					}
				}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata
	assert.Equal(t, "User Management API", ir.Metadata.Title)
	assert.Equal(t, "1.0.0", ir.Metadata.Version)
	assert.Equal(t, "API for managing users", ir.Metadata.Description)
	assert.Equal(t, "openhandler", ir.Source.Format)
	assert.Equal(t, "1.0.0", ir.Source.Version)

	// Check servers
	assert.Len(t, ir.Servers, 1)
	assert.Equal(t, "https://api.example.com", ir.Servers[0].URL)

	// Check endpoints
	assert.GreaterOrEqual(t, len(ir.Endpoints), 2)

	// Find getUser endpoint
	var getUserEndpoint *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "getUser" {
			getUserEndpoint = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, getUserEndpoint)
	assert.Equal(t, "Get user by ID", getUserEndpoint.Name)
	assert.Equal(t, "GET", getUserEndpoint.Method)
	assert.Equal(t, "/users/{id}", getUserEndpoint.Path)
	assert.Len(t, getUserEndpoint.Parameters, 1)
	assert.Equal(t, "id", getUserEndpoint.Parameters[0].Name)
	assert.Equal(t, "path", getUserEndpoint.Parameters[0].In)

	// Find createUser endpoint
	var createUserEndpoint *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "createUser" {
			createUserEndpoint = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, createUserEndpoint)
	assert.Equal(t, "Create new user", createUserEndpoint.Name)
	assert.Equal(t, "POST", createUserEndpoint.Method)
	assert.NotNil(t, createUserEndpoint.RequestBody)
	assert.True(t, createUserEndpoint.RequestBody.Required)
}

func TestOpenHandlerParser_Parse_WithComponents(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "API with Components",
			"version": "1.0.0"
		},
		"handlers": {
			"getProduct": {
				"method": "GET",
				"path": "/products/{id}",
				"responses": {
					"200": {
						"description": "Success",
						"content": {
							"application/json": {
								"schema": {"$ref": "#/components/schemas/Product"}
							}
						}
					}
				}
			}
		},
		"components": {
			"schemas": {
				"Product": {
					"type": "object",
					"description": "A product",
					"properties": {
						"id": {"type": "string"},
						"name": {"type": "string"},
						"price": {"type": "number"}
					},
					"required": ["id", "name"]
				}
			},
			"securitySchemes": {
				"bearerAuth": {
					"type": "http",
					"scheme": "bearer",
					"description": "Bearer token authentication"
				}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check types were extracted
	assert.GreaterOrEqual(t, len(ir.Types), 1)
	
	var productType *TypeDefinition
	for i := range ir.Types {
		if ir.Types[i].Name == "Product" {
			productType = &ir.Types[i]
			break
		}
	}
	require.NotNil(t, productType)
	assert.Equal(t, "object", productType.Type)
	assert.Equal(t, "A product", productType.Description)
	assert.Len(t, productType.Required, 2)
	assert.Contains(t, productType.Required, "id")
	assert.Contains(t, productType.Required, "name")

	// Check auth schemes
	assert.GreaterOrEqual(t, len(ir.Auth), 1)
	var bearerAuth *AuthScheme
	for i := range ir.Auth {
		if ir.Auth[i].Name == "bearerAuth" {
			bearerAuth = &ir.Auth[i]
			break
		}
	}
	require.NotNil(t, bearerAuth)
	assert.Equal(t, "http", bearerAuth.Type)
	assert.Equal(t, "bearer", bearerAuth.Scheme)
}

func TestOpenHandlerParser_Parse_WithMiddleware(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "API with Middleware",
			"version": "1.0.0"
		},
		"handlers": {
			"protectedEndpoint": {
				"method": "GET",
				"path": "/admin/users",
				"middleware": ["auth", "rateLimit", "logging"],
				"timeout": 30,
				"security": [{"apiKey": []}],
				"responses": {
					"200": {"description": "Success"}
				}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check endpoint
	assert.GreaterOrEqual(t, len(ir.Endpoints), 1)
	endpoint := ir.Endpoints[0]
	
	// Check middleware in extensions
	assert.NotNil(t, endpoint.Extensions)
	assert.Contains(t, endpoint.Extensions, "middleware")
	middleware, ok := endpoint.Extensions["middleware"].([]string)
	assert.True(t, ok)
	assert.Len(t, middleware, 3)
	assert.Contains(t, middleware, "auth")
	assert.Contains(t, middleware, "rateLimit")

	// Check timeout
	assert.Contains(t, endpoint.Extensions, "timeout")
	assert.Equal(t, 30, endpoint.Extensions["timeout"])

	// Check security
	assert.Len(t, endpoint.Auth, 1)
	assert.Equal(t, "apiKey", endpoint.Auth[0])
}

func TestOpenHandlerParser_Parse_WithTags(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "API with Tags",
			"version": "1.0.0"
		},
		"tags": [
			{"name": "users", "description": "User operations"},
			{"name": "admin", "description": "Admin operations"}
		],
		"handlers": {
			"getUser": {
				"method": "GET",
				"path": "/users/{id}",
				"tags": ["users"],
				"responses": {"200": {"description": "Success"}}
			},
			"adminAction": {
				"method": "POST",
				"path": "/admin/action",
				"tags": ["admin"],
				"responses": {"200": {"description": "Success"}}
			}
		}
	}`

	ir, err := parser.Parse(ctx, []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)

	// Check metadata tags
	assert.Len(t, ir.Metadata.Tags, 2)

	// Check endpoint tags
	var getUserEndpoint *UnifiedEndpoint
	for i := range ir.Endpoints {
		if ir.Endpoints[i].ID == "getUser" {
			getUserEndpoint = &ir.Endpoints[i]
			break
		}
	}
	require.NotNil(t, getUserEndpoint)
	assert.Len(t, getUserEndpoint.Tags, 1)
	assert.Equal(t, "users", getUserEndpoint.Tags[0])
}

func TestOpenHandlerParser_Validate(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "Valid API",
			"version": "1.0.0"
		},
		"handlers": {}
	}`

	ir, err := parser.Parse(ctx, []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)

	results, err := parser.Validate(ir)
	require.NoError(t, err)
	assert.NotNil(t, results)
	assert.True(t, results.Valid || results.IsValid)
}

func TestOpenHandlerParser_GetFormat(t *testing.T) {
	parser := NewOpenHandlerParser()
	assert.Equal(t, "openhandler", parser.GetFormat())
}

func TestOpenHandlerParser_GetVersion(t *testing.T) {
	parser := NewOpenHandlerParser()
	assert.Equal(t, "1.0.0", parser.GetVersion())
}

func TestOpenHandlerParser_GetSupportedVersions(t *testing.T) {
	parser := NewOpenHandlerParser()
	versions := parser.GetSupportedVersions()
	assert.Contains(t, versions, "1.0.0")
	assert.Contains(t, versions, "1.1.0")
	assert.Contains(t, versions, "1.2.0")
}

func TestOpenHandlerParser_Parse_MissingRequired(t *testing.T) {
	parser := NewOpenHandlerParser()
	ctx := context.Background()

	tests := []struct {
		name    string
		input   string
		wantErr string
	}{
		{
			name: "Missing openhandler field",
			input: `{
				"info": {"title": "Test", "version": "1.0.0"}
			}`,
			wantErr: "missing required field: openhandler",
		},
		{
			name: "Missing info.title",
			input: `{
				"openhandler": "1.0.0",
				"info": {"version": "1.0.0"}
			}`,
			wantErr: "missing required field: info.title",
		},
		{
			name: "Missing info.version",
			input: `{
				"openhandler": "1.0.0",
				"info": {"title": "Test"}
			}`,
			wantErr: "missing required field: info.version",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parser.Parse(ctx, []byte(tt.input), ParseOptions{})
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}
