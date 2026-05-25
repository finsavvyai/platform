package swagger

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// generateSwaggerConfigJSON returns a JSON string of the swagger config
func generateSwaggerConfigJSON(config SwaggerConfig) string {
	data, err := json.Marshal(config)
	if err != nil {
		return "{}"
	}
	return string(data)
}

//go:embed ui/dist/*
var swaggerFS embed.FS

// SetupRoutes configures Swagger UI routes
func SetupRoutes(r chi.Router) {
	// Serve the main OpenAPI specification
	r.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		// Read the OpenAPI spec file
		spec, err := fs.ReadFile(swaggerFS, "ui/dist/openapi.yaml")
		if err != nil {
			// Fallback to the root spec file
			spec, err = fs.ReadFile(swaggerFS, "openapi.yaml")
			if err != nil {
				http.Error(w, "OpenAPI specification not found", http.StatusNotFound)
				return
			}
		}

		w.Header().Set("Content-Type", "application/x-yaml")
		w.Write(spec)
	})

	// Serve the Swagger UI
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		// Redirect to the main Swagger UI page
		http.Redirect(w, r, "/docs/index.html", http.StatusTemporaryRedirect)
	})

	// Serve static files for Swagger UI
	r.Handle("/docs/*", http.StripPrefix("/docs/", http.FileServer(getSwaggerUIFS())))

	// API documentation endpoint
	r.Get("/docs.json", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, map[string]interface{}{
			"title":              "SDLC.ai API Documentation",
			"description":        "Comprehensive API documentation for the SDLC.ai Secure Data Learning Platform",
			"version":            "v1",
			"swagger_url":        "/docs/index.html",
			"openapi_spec":       "/openapi.yaml",
			"postman_collection": "/docs/collection.json",
			"sdk_docs": map[string]string{
				"python":     "https://docs.sdlc.ai/sdk/python",
				"typescript": "https://docs.sdlc.ai/sdk/typescript",
				"go":         "https://docs.sdlc.ai/sdk/go",
			},
		})
	})
}

// getSwaggerUIFS returns the Swagger UI filesystem
func getSwaggerUIFS() http.FileSystem {
	// Try to get the embedded UI directory first
	uiFS, err := fs.Sub(swaggerFS, "ui/dist")
	if err == nil {
		return http.FS(uiFS)
	}

	// Fallback to creating a minimal in-memory filesystem
	return http.FS(swaggerFS)
}

// SwaggerConfig holds configuration for Swagger UI
type SwaggerConfig struct {
	Title           string                     `json:"title"`
	Description     string                     `json:"description"`
	Version         string                     `json:"version"`
	BaseURL         string                     `json:"base_url"`
	Servers         []SwaggerServer            `json:"servers"`
	SecuritySchemes map[string]SwaggerSecurity `json:"security_schemes"`
	DefaultModels   []string                   `json:"default_models"`
	TryItOutEnabled bool                       `json:"try_it_out_enabled"`
	ValidateInputs  bool                       `json:"validate_inputs"`
}

// SwaggerServer represents a server configuration
type SwaggerServer struct {
	URL         string                     `json:"url"`
	Description string                     `json:"description"`
	Variables   map[string]SwaggerVariable `json:"variables,omitempty"`
}

// SwaggerVariable represents a server variable
type SwaggerVariable struct {
	Enum        []string `json:"enum,omitempty"`
	Default     string   `json:"default"`
	Description string   `json:"description,omitempty"`
}

// SwaggerSecurity represents a security scheme
type SwaggerSecurity struct {
	Type             string                 `json:"type"`
	Scheme           string                 `json:"scheme,omitempty"`
	Description      string                 `json:"description"`
	Name             string                 `json:"name,omitempty"`
	In               string                 `json:"in,omitempty"`
	BearerFormat     string                 `json:"bearerFormat,omitempty"`
	Flows            map[string]interface{} `json:"flows,omitempty"`
	OpenIDConnectURL string                 `json:"openIdConnectUrl,omitempty"`
}

// GetSwaggerConfig returns the Swagger configuration
func GetSwaggerConfig(baseURL string) SwaggerConfig {
	return SwaggerConfig{
		Title:           "SDLC.ai API",
		Description:     "Secure Data Learning Platform API",
		Version:         "1.0.0",
		BaseURL:         baseURL,
		TryItOutEnabled: true,
		ValidateInputs:  true,
		Servers: []SwaggerServer{
			{
				URL:         baseURL,
				Description: "Current server",
				Variables: map[string]SwaggerVariable{
					"tenant": {
						Default:     "demo",
						Description: "Tenant identifier",
					},
				},
			},
			{
				URL:         "https://api.sdlc.ai/v1",
				Description: "Production server",
			},
			{
				URL:         "https://staging-api.sdlc.ai/v1",
				Description: "Staging server",
			},
		},
		SecuritySchemes: map[string]SwaggerSecurity{
			"BearerAuth": {
				Type:         "http",
				Scheme:       "bearer",
				BearerFormat: "JWT",
				Description:  "JWT authentication token obtained from /auth/login",
			},
			"ApiKeyAuth": {
				Type:        "apiKey",
				Name:        "X-API-Key",
				In:          "header",
				Description: "API key for service-to-service authentication",
			},
		},
		DefaultModels: []string{
			"User",
			"Tenant",
			"Document",
			"RAGQueryRequest",
			"RAGQueryResponse",
		},
	}
}

// CustomSwaggerUI returns custom HTML for the Swagger UI
func CustomSwaggerUI(config SwaggerConfig) string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>` + config.Title + ` Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .swagger-ui .topbar {
            background-color: #1a202c;
            border-bottom: 1px solid #2d3748;
        }
        .swagger-ui .topbar .download-url-wrapper {
            display: none;
        }
        .swagger-ui .info {
            margin: 50px 0;
        }
        .swagger-ui .info .title {
            color: #1a202c;
            font-size: 36px;
        }
        .custom-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
        }
        .custom-header h1 {
            margin: 0;
            font-size: 24px;
        }
        .custom-header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .api-info-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .info-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .info-card h3 {
            margin: 0 0 10px 0;
            color: #2d3748;
        }
        .info-card p {
            margin: 0;
            color: #718096;
        }
        .try-it-out-btn {
            background-color: #667eea !important;
            border-color: #667eea !important;
        }
        .try-it-out-btn:hover {
            background-color: #5a67d8 !important;
            border-color: #5a67d8 !important;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const config = ` + generateSwaggerConfigJSON(config) + `;

            const ui = SwaggerUIBundle({
                url: '/openapi.yaml',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                defaultModelsExpandDepth: 2,
                defaultModelExpandDepth: 2,
                displayOperationId: false,
                displayRequestDuration: true,
                docExpansion: "list",
                filter: true,
                showExtensions: true,
                showCommonExtensions: true,
                tryItOutEnabled: ` + fmt.Sprintf("%t", config.TryItOutEnabled) + `,
                requestInterceptor: function(request) {
                    // Add default headers
                    request.headers['X-Request-ID'] = generateUUID();
                    request.headers['X-Client-Version'] = '1.0.0';
                    return request;
                },
                responseInterceptor: function(response) {
                    // Log responses for debugging
                    if (response.url.includes('/auth/login')) {
                        console.log('Login response:', response);
                    }
                    return response;
                },
                onComplete: function() {
                    console.log("Swagger UI loaded successfully");

                    // Add custom headers section
                    addCustomHeadersSection();
                },
                ...config
            });
        };

        function generateSwaggerConfigJSON(config) {
            return JSON.stringify({
                spec: {
                    servers: config.servers,
                    securitySchemes: config.security_schemes
                },
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                onComplete: function() {
                    console.log("Swagger UI loaded");
                }
            });
        }

        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        function addCustomHeadersSection() {
            const infoDiv = document.querySelector('.swagger-ui .info');
            if (infoDiv) {
                const customHTML = ` +
		generateCustomInfoCards(config) + `;
                infoDiv.insertAdjacentHTML('afterend', customHTML);
            }
        }
    </script>
</body>
</html>`
}

// generateCustomInfoCards generates the custom info cards HTML
func generateCustomInfoCards(config SwaggerConfig) string {
	return `
    <div class="custom-header">
        <h1>` + config.Title + `</h1>
        <p>` + config.Description + ` - Interactive API Documentation</p>
    </div>

    <div class="api-info-cards">
        <div class="info-card">
            <h3>🔐 Authentication</h3>
            <p>Use JWT Bearer tokens or API keys for authentication. Get started by logging in to get your access token.</p>
        </div>
        <div class="info-card">
            <h3>🚀 Quick Start</h3>
            <p>1. Login with <code>/auth/login</code><br>
               2. Use the returned token in Authorization header<br>
               3. Start exploring the API endpoints</p>
        </div>
        <div class="info-card">
            <h3>📚 Documentation</h3>
            <p>Comprehensive documentation available at <a href="https://docs.sdlc.ai" target="_blank">docs.sdlc.ai</a></p>
        </div>
        <div class="info-card">
            <h3>🔧 SDKs</h3>
            <p>Official SDKs available for Python, TypeScript, and Go. Check the documentation for installation instructions.</p>
        </div>
        <div class="info-card">
            <h3>📊 Rate Limiting</h3>
            <p>API requests are rate-limited. Check response headers for X-RateLimit-* information.</p>
        </div>
        <div class="info-card">
            <h3>🐛 Issues & Support</h3>
            <p>Report issues on GitHub or contact support at support@sdlc.ai</p>
        </div>
    </div>`
}
