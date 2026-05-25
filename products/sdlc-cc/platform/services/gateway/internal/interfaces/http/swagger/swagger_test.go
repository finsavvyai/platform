package swagger

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSetupRoutes(t *testing.T) {
	r := chi.NewRouter()
	SetupRoutes(r)

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		expectedType   string
	}{
		{
			name:           "OpenAPI spec endpoint",
			path:           "/openapi.yaml",
			expectedStatus: http.StatusOK,
			expectedType:   "application/x-yaml",
		},
		{
			name:           "Docs redirect",
			path:           "/docs",
			expectedStatus: http.StatusTemporaryRedirect,
		},
		{
			name:           "Docs JSON endpoint",
			path:           "/docs.json",
			expectedStatus: http.StatusOK,
			expectedType:   "application/json",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			w := httptest.NewRecorder()

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedType != "" {
				assert.Equal(t, tt.expectedType, w.Header().Get("Content-Type"))
			}
		})
	}
}

func TestGetSwaggerConfig(t *testing.T) {
	baseURL := "https://api.test.com/v1"
	config := GetSwaggerConfig(baseURL)

	assert.Equal(t, "SDLC.ai API", config.Title)
	assert.Equal(t, "Secure Data Learning Platform API", config.Description)
	assert.Equal(t, "1.0.0", config.Version)
	assert.Equal(t, baseURL, config.BaseURL)
	assert.True(t, config.TryItOutEnabled)
	assert.True(t, config.ValidateInputs)

	require.Len(t, config.Servers, 3)
	assert.Equal(t, baseURL, config.Servers[0].URL)
	assert.Equal(t, "Current server", config.Servers[0].Description)

	require.Contains(t, config.SecuritySchemes, "BearerAuth")
	require.Contains(t, config.SecuritySchemes, "ApiKeyAuth")

	bearerAuth := config.SecuritySchemes["BearerAuth"]
	assert.Equal(t, "http", bearerAuth.Type)
	assert.Equal(t, "bearer", bearerAuth.Scheme)
	assert.Equal(t, "JWT", bearerAuth.BearerFormat)
}

// TestCustomSwaggerUI verifies the Scalar-powered HTML renderer. The
// function name is retained from the Swagger UI era for backwards
// compatibility with existing callers.
func TestCustomSwaggerUI(t *testing.T) {
	config := SwaggerConfig{
		Title:           "Test API",
		Description:     "Test Description",
		Version:         "1.0.0",
		TryItOutEnabled: true,
		ValidateInputs:  true,
	}

	html := CustomSwaggerUI(config)

	// Branding is still surfaced in the banner and metadata.
	assert.Contains(t, html, "Test API")
	assert.Contains(t, html, "Test Description")

	// Scalar-specific markers.
	assert.Contains(t, html, `id="api-reference"`)
	assert.Contains(t, html, `data-url="/openapi.yaml"`)
	assert.Contains(t, html, "@scalar/api-reference")
	assert.Contains(t, html, "deepSpace")
	assert.Contains(t, html, `"darkMode":true`)

	// Swagger UI must no longer be loaded from the network.
	assert.NotContains(t, html, "swagger-ui.css")
	assert.NotContains(t, html, "unpkg.com/swagger-ui-dist")
}

func TestScalarConfigJSON(t *testing.T) {
	config := SwaggerConfig{
		Title:       `Test "API"`,
		Description: "Test Description",
	}

	out := scalarConfigJSON(config)

	assert.Contains(t, out, `"theme":"deepSpace"`)
	assert.Contains(t, out, `"darkMode":true`)
	assert.Contains(t, out, `"layout":"modern"`)
	assert.Contains(t, out, `Test \"API\"`)
}

func TestJSAttrEscape(t *testing.T) {
	assert.Equal(t, `hello`, jsAttrEscape("hello"))
	assert.Equal(t, `a\'b`, jsAttrEscape("a'b"))
	assert.Equal(t, `a\"b`, jsAttrEscape(`a"b`))
	assert.Equal(t, `a b`, jsAttrEscape("a\nb"))
	assert.Equal(t, `a b`, jsAttrEscape("a\rb"))
	assert.Equal(t, `a\\b`, jsAttrEscape(`a\b`))
}

func TestGetSwaggerUIFS(t *testing.T) {
	// Exercises the happy path; fs.Sub should resolve "ui/dist" even if the
	// embedded subtree has no other files (the //go:embed directive at least
	// embeds the directory itself).
	fsys := getSwaggerUIFS()
	require.NotNil(t, fsys)
}

func TestSetupRoutesDocsIndexHTML(t *testing.T) {
	// The /docs/* handler serves embedded static files via StripPrefix.
	// Hitting an unknown asset should return 404 without panicking, which
	// exercises the FileServer branch in SetupRoutes.
	r := chi.NewRouter()
	SetupRoutes(r)

	req := httptest.NewRequest("GET", "/docs/does-not-exist.html", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSwaggerDocsJSONEndpoint(t *testing.T) {
	r := chi.NewRouter()
	SetupRoutes(r)

	req := httptest.NewRequest("GET", "/docs.json", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "SDLC.ai API Documentation", response["title"])
	assert.Equal(t, "Comprehensive API documentation for the SDLC.ai Secure Data Learning Platform", response["description"])
	assert.Equal(t, "v1", response["version"])
	assert.Equal(t, "/docs/index.html", response["swagger_url"])
	assert.Equal(t, "/openapi.yaml", response["openapi_spec"])
	assert.Equal(t, "scalar", response["renderer"])

	sdkDocs, ok := response["sdk_docs"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "https://docs.sdlc.cc/sdk/python", sdkDocs["python"])
	assert.Equal(t, "https://docs.sdlc.cc/sdk/typescript", sdkDocs["typescript"])
	assert.Equal(t, "https://docs.sdlc.cc/sdk/go", sdkDocs["go"])
}

func BenchmarkCustomSwaggerUI(b *testing.B) {
	config := SwaggerConfig{
		Title:           "SDLC.ai API",
		Description:     "Secure Data Learning Platform API",
		Version:         "1.0.0",
		TryItOutEnabled: true,
		ValidateInputs:  true,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = CustomSwaggerUI(config)
	}
}
