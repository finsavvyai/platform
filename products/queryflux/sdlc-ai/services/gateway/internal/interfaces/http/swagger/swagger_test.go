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

	// Check servers
	require.Len(t, config.Servers, 3)
	assert.Equal(t, baseURL, config.Servers[0].URL)
	assert.Equal(t, "Current server", config.Servers[0].Description)

	// Check security schemes
	require.Contains(t, config.SecuritySchemes, "BearerAuth")
	require.Contains(t, config.SecuritySchemes, "ApiKeyAuth")

	bearerAuth := config.SecuritySchemes["BearerAuth"]
	assert.Equal(t, "http", bearerAuth.Type)
	assert.Equal(t, "bearer", bearerAuth.Scheme)
	assert.Equal(t, "JWT", bearerAuth.BearerFormat)
}

func TestCustomSwaggerUI(t *testing.T) {
	config := SwaggerConfig{
		Title:           "Test API",
		Description:     "Test Description",
		Version:         "1.0.0",
		TryItOutEnabled: true,
		ValidateInputs:  true,
	}

	html := CustomSwaggerUI(config)

	assert.Contains(t, html, "Test API")
	assert.Contains(t, html, "Test Description")
	assert.Contains(t, html, "swagger-ui-bundle.js")
	assert.Contains(t, html, "SwaggerUIBundle")
	assert.Contains(t, html, "tryItOutEnabled: true")
}

func TestGenerateCustomInfoCards(t *testing.T) {
	config := SwaggerConfig{
		Title:       "Test API",
		Description: "Test Description",
	}

	html := generateCustomInfoCards(config)

	assert.Contains(t, html, "Test API")
	assert.Contains(t, html, "Test Description")
	assert.Contains(t, html, "🔐 Authentication")
	assert.Contains(t, html, "🚀 Quick Start")
	assert.Contains(t, html, "📚 Documentation")
	assert.Contains(t, html, "🔧 SDKs")
	assert.Contains(t, html, "📊 Rate Limiting")
	assert.Contains(t, html, "🐛 Issues & Support")
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

	// Check SDK docs
	sdkDocs, ok := response["sdk_docs"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "https://docs.sdlc.ai/sdk/python", sdkDocs["python"])
	assert.Equal(t, "https://docs.sdlc.ai/sdk/typescript", sdkDocs["typescript"])
	assert.Equal(t, "https://docs.sdlc.ai/sdk/go", sdkDocs["go"])
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

func BenchmarkGenerateCustomInfoCards(b *testing.B) {
	config := SwaggerConfig{
		Title:       "SDLC.ai API",
		Description: "Secure Data Learning Platform API",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = generateCustomInfoCards(config)
	}
}
