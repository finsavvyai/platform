package swagger

// SwaggerConfig holds configuration for the API documentation reference.
// The name is preserved for backwards compatibility; it now drives Scalar.
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

// SwaggerServer represents a server configuration.
type SwaggerServer struct {
	URL         string                     `json:"url"`
	Description string                     `json:"description"`
	Variables   map[string]SwaggerVariable `json:"variables,omitempty"`
}

// SwaggerVariable represents a server variable.
type SwaggerVariable struct {
	Enum        []string `json:"enum,omitempty"`
	Default     string   `json:"default"`
	Description string   `json:"description,omitempty"`
}

// SwaggerSecurity represents a security scheme.
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

// GetSwaggerConfig returns the default documentation configuration.
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
				URL:         "https://api.sdlc.cc/v1",
				Description: "Production server",
			},
			{
				URL:         "https://staging-api.sdlc.cc/v1",
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
