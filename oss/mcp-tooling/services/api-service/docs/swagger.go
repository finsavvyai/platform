// Package docs MCPOverflow API Documentation
//
// MCPOverflow is an AI-powered MCP Connector Generation Platform
// that allows you to generate MCP connectors from OpenAPI, GraphQL,
// and Postman collections.
//
//	Schemes: https
//	Host: api.mcpoverflow.io
//	BasePath: /api/v1
//	Version: 0.1.4
//
//	Consumes:
//	- application/json
//
//	Produces:
//	- application/json
//
//	Security:
//	- Bearer:
//	- APIKey:
//
//	SecurityDefinitions:
//	Bearer:
//	  type: apiKey
//	  name: Authorization
//	  in: header
//	  description: JWT token with Bearer prefix. Example: "Bearer eyJhbGciOiJIUzI1NiIs..."
//	APIKey:
//	  type: apiKey
//	  name: X-API-Key
//	  in: header
//	  description: API Key for programmatic access
//
// swagger:meta
package docs

import "time"

// Generic API error response
// swagger:response errorResponse
type ErrorResponse struct {
	// The error message
	// example: Invalid request parameters
	Error string `json:"error"`
	// Error code for programmatic handling
	// example: VALIDATION_ERROR
	Code string `json:"code"`
	// Additional error details
	// example: Field 'name' is required
	Details string `json:"details,omitempty"`
}

// Health check response
// swagger:response healthResponse
type HealthResponse struct {
	// Service status
	// example: ok
	Status string `json:"status"`
	// Service name
	// example: mcpoverflow-api
	Service string `json:"service"`
	// API version
	// example: 0.1.4
	Version string `json:"version"`
	// Service uptime
	// example: 24h35m12s
	Uptime string `json:"uptime"`
}

// Readiness check response
// swagger:response readyResponse
type ReadyResponse struct {
	// Readiness status
	// example: ready
	Status string `json:"status"`
	// Dependency health status
	Dependencies map[string]DependencyStatus `json:"dependencies"`
}

// DependencyStatus represents health of a service dependency
type DependencyStatus struct {
	// Dependency status
	// example: healthy
	Status string `json:"status"`
	// Response latency
	// example: 2.5ms
	Latency string `json:"latency,omitempty"`
}

// swagger:parameters createConnector
type CreateConnectorParams struct {
	// Connector creation request
	// in: body
	// required: true
	Body CreateConnectorRequest
}

// CreateConnectorRequest represents a new connector request
type CreateConnectorRequest struct {
	// Connector name
	// required: true
	// example: Stripe API Connector
	Name string `json:"name"`
	// Connector description
	// example: MCP connector for Stripe payment API
	Description string `json:"description"`
	// API specification type
	// required: true
	// enum: openapi,graphql,postman
	// example: openapi
	SpecType string `json:"spec_type"`
	// Raw API specification content
	// required: true
	SpecContent string `json:"spec_content"`
}

// swagger:response connectorResponse
type ConnectorResponse struct {
	// in: body
	Body Connector
}

// Connector represents an MCP connector
type Connector struct {
	// Unique connector ID
	// example: conn_abc123def456
	ID string `json:"id"`
	// Connector name
	// example: Stripe API Connector
	Name string `json:"name"`
	// Connector description
	Description string `json:"description"`
	// Owner user ID
	UserID string `json:"user_id"`
	// Specification type
	// example: openapi
	SpecType string `json:"spec_type"`
	// Connector status
	// enum: draft,processing,ready,deployed,error
	// example: ready
	Status string `json:"status"`
	// Number of tools generated
	// example: 45
	ToolCount int `json:"tool_count"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
	// Last update timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// swagger:response connectorListResponse
type ConnectorListResponse struct {
	// in: body
	Body struct {
		Data  []Connector `json:"data"`
		Total int         `json:"total"`
		Page  int         `json:"page"`
		Limit int         `json:"limit"`
	}
}

// swagger:parameters loginRequest
type LoginParams struct {
	// Login credentials
	// in: body
	// required: true
	Body LoginRequest
}

// LoginRequest represents authentication credentials
type LoginRequest struct {
	// User email address
	// required: true
	// example: user@example.com
	Email string `json:"email"`
	// User password
	// required: true
	// example: securePassword123
	Password string `json:"password"`
}

// swagger:response authResponse
type AuthResponse struct {
	// in: body
	Body struct {
		// JWT access token
		// example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
		AccessToken string `json:"access_token"`
		// Refresh token for obtaining new access tokens
		RefreshToken string `json:"refresh_token"`
		// Token expiration time in seconds
		// example: 3600
		ExpiresIn int `json:"expires_in"`
		// Token type
		// example: Bearer
		TokenType string `json:"token_type"`
	}
}

// swagger:response userResponse
type UserResponse struct {
	// in: body
	Body User
}

// User represents a user account
type User struct {
	// Unique user ID
	// example: user_123abc
	ID string `json:"id"`
	// User email
	// example: user@example.com
	Email string `json:"email"`
	// Display name
	// example: John Doe
	Name string `json:"name"`
	// Account creation date
	CreatedAt time.Time `json:"created_at"`
}

// swagger:parameters deployConnector
type DeployConnectorParams struct {
	// Connector ID to deploy
	// in: path
	// required: true
	// example: conn_abc123def456
	ID string `json:"id"`
}

// swagger:response deploymentResponse
type DeploymentResponse struct {
	// in: body
	Body Deployment
}

// Deployment represents a connector deployment
type Deployment struct {
	// Deployment ID
	// example: deploy_xyz789
	ID string `json:"id"`
	// Associated connector ID
	ConnectorID string `json:"connector_id"`
	// Deployment status
	// enum: pending,deploying,deployed,failed,rolled_back
	// example: deployed
	Status string `json:"status"`
	// Deployed worker URL
	// example: https://my-connector.mcpoverflow.workers.dev
	URL string `json:"url,omitempty"`
	// Deployment timestamp
	CreatedAt time.Time `json:"created_at"`
}
