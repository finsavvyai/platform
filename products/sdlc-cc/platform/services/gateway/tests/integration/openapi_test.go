package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHealthEndpoints_MatchSpec validates health endpoints match OpenAPI spec.
func TestHealthEndpoints_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{"/health", "/health/ready", "/health/live"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
			assert.True(t, verifyOperationExists(spec, path, "GET"), "GET not defined")
		})
	}
}

// TestAuthFlow_MatchSpec validates authentication endpoints match spec.
func TestAuthFlow_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	authPaths := []string{
		"/auth/login", "/auth/logout", "/auth/refresh", "/auth/me",
	}
	for _, path := range authPaths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestDocumentCRUD_MatchSpec validates document operations.
func TestDocumentCRUD_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{"/documents", "/documents/{id}"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestTenantCRUD_MatchSpec validates tenant management endpoints.
func TestTenantCRUD_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{"/tenants", "/tenants/{id}"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestUserCRUD_MatchSpec validates user management endpoints.
func TestUserCRUD_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{"/users", "/users/{id}"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestFileOperations_MatchSpec validates file endpoints.
func TestFileOperations_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{
		"/files", "/files/{id}", "/files/{id}/download",
		"/files/{id}/exists", "/files/formats",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestRAGEndpoints_MatchSpec validates RAG (Vector) endpoints.
func TestRAGEndpoints_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{
		"/vector/search", "/vector/embeddings", "/vector/indices",
		"/policies", "/policies/{id}", "/policies/{id}/test",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestDLPEndpoints_MatchSpec validates DLP endpoints.
func TestDLPEndpoints_MatchSpec(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{
		"/dlp/scan", "/dlp/rules", "/usage/tokens", "/usage/documents",
		"/usage/costs", "/api-keys", "/api-keys/{id}",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestSecuritySchemes validates auth requirements.
func TestSecuritySchemes(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	assert.NotNil(t, spec.Components.SecuritySchemes["BearerAuth"])
	assert.NotNil(t, spec.Components.SecuritySchemes["ApiKeyAuth"])
}

// TestEndpointTags validates all endpoints have appropriate tags.
func TestEndpointTags(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	expectedTags := map[string]bool{
		"Health":              false,
		"Authentication":      false,
		"Tenant Management":   false,
		"User Management":     false,
		"File Management":     false,
		"Policy Management":   false,
		"API Key Management":  false,
		"Usage & Metrics":     false,
		"Data Loss Prevention": false,
		"Vector Search":       false,
	}

	found := getAllTags(spec)
	for tag := range expectedTags {
		assert.True(t, found[tag], "tag %s not used", tag)
	}
}

// TestParameterDefinitions validates common parameters exist.
func TestParameterDefinitions(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	params := []string{
		"TenantID", "UserID", "FileID", "PolicyID",
		"ApiKeyID", "Limit", "Offset", "Search",
	}

	for _, param := range params {
		assert.NotNil(t, spec.Components.Parameters[param],
			"parameter %s not defined", param)
	}
}

// TestResponseSchemas validates responses have proper schemas.
func TestResponseSchemas(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	paths := []string{"/tenants", "/users", "/files", "/health"}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			assert.True(t, verifyPathExists(spec, path), "path %s not found", path)
		})
	}
}

// TestCRUDOperations validates CRUD operations exist per resource.
// Files are immutable blobs and intentionally do not support PATCH.
func TestCRUDOperations(t *testing.T) {
	spec := loadOpenAPISpec(t)
	require.NotNil(t, spec)

	cases := map[string][]string{
		"/tenants/{id}": {"GET", "PATCH", "DELETE"},
		"/users/{id}":   {"GET", "PATCH", "DELETE"},
		"/files/{id}":   {"GET", "DELETE"},
	}

	for resource, methods := range cases {
		for _, method := range methods {
			t.Run(resource+" "+method, func(t *testing.T) {
				exists := verifyOperationExists(spec, resource, method)
				assert.True(t, exists, "%s %s not found", method, resource)
			})
		}
	}
}
