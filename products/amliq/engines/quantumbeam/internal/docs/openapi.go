package docs

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3gen"
)

// OpenAPIDoc represents the complete OpenAPI documentation
type OpenAPIDoc struct {
	doc     *openapi3.T
	generator *openapi3gen.Generator
}

// NewOpenAPIDoc creates a new OpenAPI documentation instance
func NewOpenAPIDoc() *OpenAPIDoc {
	doc := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:          "QuantumBeam Fraud Detection API",
			Description:    "A comprehensive fraud detection platform with AI/ML and quantum computing capabilities",
			Version:        "1.0.0",
			TermsOfService: "https://quantumbeam.io/terms",
			Contact: &openapi3.Contact{
				Name:  "QuantumBeam API Support",
				Email: "api-support@quantumbeam.io",
				URL:   "https://quantumbeam.io/support",
			},
			License: &openapi3.License{
				Name: "MIT",
				URL:   "https://opensource.org/licenses/MIT",
			},
		},
		Servers: []*openapi3.Server{
			{
				URL:         "https://api.quantumbeam.io/v1",
				Description: "Production server",
			},
			{
				URL:         "https://staging-api.quantumbeam.io/v1",
				Description: "Staging server",
			},
			{
				URL:         "http://localhost:8080/v1",
				Description: "Development server",
			},
		},
		Paths: openapi3.Paths{},
		Components: &openapi3.Components{
			Schemas:  openapi3.Schemas{},
			Responses: openapi3.Responses{},
			Parameters: openapi3.Parameters{},
			Examples: openapi3.Examples{},
			RequestBodies: openapi3.RequestBodies(),
			Headers: openapi3.Headers(),
			SecuritySchemes: openapi3.SecuritySchemes{},
			Links: openapi3.Links(),
			Callbacks: openapi3.Callbacks(),
		},
		Security: openapi3.SecurityRequirements{},
		Tags: []*openapi3.Tag{},
		ExternalDocs: &openapi3.ExternalDocumentation{
			Description: "Find more info here",
			URL:         "https://quantumbeam.io/docs",
		},
	}

	return &OpenAPIDoc{
		doc: doc,
		generator: &openapi3gen.Generator{},
	}
}

// BuildDocumentation builds the complete OpenAPI documentation
func (o *OpenAPIDoc) BuildDocumentation() *openapi3.T {
	// Add basic security schemes
	o.addSecuritySchemes()

	// Add common schemas
	o.addCommonSchemas()

	// Add authentication endpoints
	o.addAuthEndpoints()

	// Add user management endpoints
	o.addUserEndpoints()

	// Add fraud detection endpoints
	o.addFraudDetectionEndpoints()

	// Add API management endpoints
	o.addAPIManagementEndpoints()

	// Add admin endpoints
	o.addAdminEndpoints()

	// Add monitoring endpoints
	o.addMonitoringEndpoints()

	// Add webhook endpoints
	o.addWebhookEndpoints()

	// Add tags
	o.addTags()

	return o.doc
}

// addSecuritySchemes adds security schemes to the documentation
func (o *OpenAPIDoc) addSecuritySchemes() {
	o.doc.Components.SecuritySchemes = openapi3.SecuritySchemes{
		"bearerAuth": &openapi3.SecuritySchemeRef{
			Value: &openapi3.SecurityScheme{
				Type:         "http",
				Scheme:       "bearer",
				BearerFormat: "JWT",
				Description:  "JWT Authentication token",
			},
		},
		"apiKeyAuth": &openapi3.SecuritySchemeRef{
			Value: &openapi3.SecurityScheme{
				Type:         "apiKey",
				In:           "header",
				Name:         "X-API-Key",
				Description:  "API key for authentication",
			},
		},
		"basicAuth": &openapi3.SecuritySchemeRef{
			Value: &openapi3.SecurityScheme{
				Type:        "http",
				Scheme:      "basic",
				Description: "Basic HTTP authentication",
			},
		},
	}
}

// addCommonSchemas adds common schema definitions
func (o *OpenAPIDoc) addCommonSchemas() {
	// Error response schema
	o.doc.Components.Schemas["ErrorResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status (success/error)",
						Enum:        []interface{}{"success", "error"},
					},
				},
				"error": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Error code (if status is error)",
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Human-readable message",
					},
				},
				"code": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Machine-readable error code",
					},
				},
				"details": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Additional error details",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
				"path": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Request path",
					},
				},
				"method": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "HTTP method",
					},
				},
			},
			Required: []string{"status", "message", "request_id", "timestamp"},
		},
	}

	// Pagination schema
	o.doc.Components.Schemas["Pagination"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"page": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Current page number",
						Minimum:     json.Number("1"),
					},
				},
				"per_page": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Items per page",
						Minimum:     json.Number("1"),
						Maximum:     json.Number("100"),
					},
				},
				"total": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Total number of items",
						Minimum:     json.Number("0"),
					},
				},
				"total_pages": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Total number of pages",
						Minimum:     json.Number("0"),
					},
				},
				"has_next": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether there is a next page",
					},
				},
				"has_prev": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether there is a previous page",
					},
				},
			},
			Required: []string{"page", "per_page", "total", "total_pages", "has_next", "has_prev"},
		},
	}

	// User schema
	o.doc.Components.Schemas["User"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "User ID",
						Format:      "uuid",
						ReadOnly:    true,
					},
				},
				"username": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Username",
						MinLength:   json.Number("3"),
						MaxLength:   json.Number("50"),
					},
				},
				"email": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Email address",
						Format:      "email",
					},
				},
				"full_name": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Full name",
						MaxLength:   json.Number("100"),
					},
				},
				"phone": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Phone number",
						MaxLength:   json.Number("20"),
					},
				},
				"country": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Country code (ISO 3166-1 alpha-2)",
						MinLength:   json.Number("2"),
						MaxLength:   json.Number("2"),
					},
				},
				"currency": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Currency code (ISO 4217)",
						MinLength:   json.Number("3"),
						MaxLength:   json.Number("3"),
					},
				},
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Account status",
						Enum:        []interface{}{"active", "suspended", "closed", "frozen"},
					},
				},
				"email_verified": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether email is verified",
					},
				},
				"phone_verified": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether phone is verified",
					},
				},
				"kyc_verified": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether KYC is verified",
					},
				},
				"kyc_level": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "KYC level",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("5"),
					},
				},
				"risk_score": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Risk score (0-1)",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"credit_limit": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Credit limit",
						Minimum:     json.Number("0"),
					},
				},
				"created_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Creation timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"updated_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last update timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"last_login_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last login timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
			},
			Required: []string{"id", "username", "email", "country", "status"},
		},
	}

	// Transaction schema
	o.doc.Components.Schemas["Transaction"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Transaction ID",
						Format:      "uuid",
						ReadOnly:    true,
					},
				},
				"transaction_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "External transaction ID",
						MaxLength:   json.Number("255"),
					},
				},
				"user_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "User ID",
						Format:      "uuid",
					},
				},
				"merchant_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Merchant ID",
						Format:      "uuid",
					},
				},
				"payment_method_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Payment method ID",
						Format:      "uuid",
					},
				},
				"amount": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Transaction amount",
						Minimum:     json.Number("0.01"),
						Maximum:     json.Number("999999.99"),
					},
				},
				"currency": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Currency code (ISO 4217)",
						MinLength:   json.Number("3"),
						MaxLength:   json.Number("3"),
					},
				},
				"description": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Transaction description",
						MaxLength:   json.Number("500"),
					},
				},
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Transaction status",
						Enum:        []interface{}{"pending", "approved", "declined", "fraud_detected", "investigation", "completed"},
					},
				},
				"risk_level": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Risk level",
						Enum:        []interface{}{"LOW", "MEDIUM", "HIGH"},
					},
				},
				"fraud_score": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Fraud score (0-1)",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"confidence": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Confidence level (0-1)",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"recommendation": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "System recommendation",
						Enum:        []interface{}{"approve", "decline", "review"},
					},
				},
				"processing_time_ms": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Processing time in milliseconds",
						Minimum:     json.Number("0"),
					},
				},
				"ai_analysis": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "AI analysis results",
					},
				},
				"quantum_analysis": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Quantum analysis results",
					},
				},
				"location": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/Location",
					},
				},
				"device": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/Device",
					},
				},
				"metadata": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Additional metadata",
					},
				},
				"created_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Creation timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"updated_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last update timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"completed_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Completion timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
			},
			Required: []string{"id", "transaction_id", "user_id", "merchant_id", "amount", "currency", "status"},
		},
	}

	// Location schema
	o.doc.Components.Schemas["Location"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"lat": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Latitude",
						Minimum:     json.Number("-90"),
						Maximum:     json.Number("90"),
					},
				},
				"lng": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Longitude",
						Minimum:     json.Number("-180"),
						Maximum:     json.Number("180"),
					},
				},
				"country": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Country code (ISO 3166-1 alpha-2)",
						MinLength:   json.Number("2"),
						MaxLength:   json.Number("2"),
					},
				},
				"city": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "City name",
						MaxLength:   json.Number("100"),
					},
				},
				"postal_code": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Postal code",
						MaxLength:   json.Number("20"),
					},
				},
			},
			Required: []string{"lat", "lng"},
		},
	}

	// Device schema
	o.doc.Components.Schemas["Device"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"fingerprint": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Device fingerprint",
						MaxLength:   json.Number("255"),
					},
				},
				"user_agent": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "User agent string",
						MaxLength:   json.Number("1000"),
					},
				},
				"ip_address": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "IP address",
						Format:      "ipv4",
					},
				},
				"device_type": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Device type",
						Enum:        []interface{}{"desktop", "mobile", "tablet", "unknown"},
					},
				},
				"os": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Operating system",
						MaxLength:   json.Number("50"),
					},
				},
				"browser": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Browser name",
						MaxLength:   json.Number("50"),
					},
				},
			},
			Required: []string{"fingerprint"},
		},
	}

	// Fraud Analysis schema
	o.doc.Components.Schemas["FraudAnalysis"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"transaction_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Transaction ID",
						Format:      "uuid",
					},
				},
				"fraud_score": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Fraud probability score (0-1)",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"confidence": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Confidence level in the score (0-1)",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"risk_level": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Risk level assessment",
						Enum:        []interface{}{"LOW", "MEDIUM", "HIGH"},
					},
				},
				"recommendation": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "System recommendation",
						Enum:        []interface{}{"approve", "decline", "review"},
					},
				},
				"risk_factors": {
					Value: &openapi3.Schema{
						Type: "array",
						Items: &openapi3.SchemaRef{
							Value: &openapi3.Schema{
								Type: "string",
							},
						},
						Description: "Identified risk factors",
					},
				},
				"ai_analysis": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/AIAnalysis",
					},
				},
				"quantum_analysis": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/QuantumAnalysis",
					},
				},
				"processing_time_ms": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Processing time in milliseconds",
						Minimum:     json.Number("0"),
					},
				},
				"analysis_timestamp": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Analysis timestamp",
						Format:      "date-time",
					},
				},
			},
			Required: []string{"transaction_id", "fraud_score", "confidence", "risk_level", "recommendation"},
		},
	}

	// AI Analysis schema
	o.doc.Components.Schemas["AIAnalysis"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"model_version": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "AI model version used",
					},
				},
				"risk_factors": {
					Value: &openapi3.Schema{
						Type: "array",
						Items: &openapi3.SchemaRef{
							Value: &openapi3.Schema{
								Type: "object",
								Properties: map[string]*openapi3.SchemaRef{
									"factor": {
										Value: &openapi3.Schema{
											Type: "string",
										},
									},
									"weight": {
										Value: &openapi3.Schema{
											Type: "number",
										},
									},
									"description": {
										Value: &openapi3.Schema{
											Type: "string",
										},
									},
								},
							},
						},
					},
				},
				"anomaly_score": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Anomaly detection score",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"confidence_breakdown": {
					Value: &openapi3.Schema{
						Type: "object",
						Description: "Confidence breakdown by analysis type",
					},
				},
			},
		},
	}

	// Quantum Analysis schema
	o.doc.Components.Schemas["QuantumAnalysis"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"quantum_state": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Quantum state information",
					},
				},
				"entanglement_score": {
					Value: &openapi3.Schema{
						Type:        "number",
						Description: "Quantum entanglement score",
						Minimum:     json.Number("0"),
						Maximum:     json.Number("1"),
					},
				},
				"superposition_analysis": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Superposition analysis results",
					},
				},
				"quantum_fingerprint": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Quantum fingerprint hash",
					},
				},
				"backend_used": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Quantum backend used",
					},
				},
				"shots_executed": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Number of quantum shots executed",
						Minimum:     json.Number("1"),
					},
				},
			},
		},
	}

	// API Key schema
	o.doc.Components.Schemas["APIKey"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API Key ID",
						Format:      "uuid",
						ReadOnly:    true,
					},
				},
				"name": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API Key name",
						MaxLength:   json.Number("255"),
					},
				},
				"description": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API Key description",
						MaxLength:   json.Number("1000"),
					},
				},
				"key": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API Key (only returned on creation)",
						MinLength:   json.Number("16"),
					},
				},
				"key_hash": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API Key hash",
						ReadOnly:    true,
					},
				},
				"permissions": {
					Value: &openapi3.Schema{
						Type: "array",
						Items: &openapi3.SchemaRef{
							Value: &openapi3.Schema{
								Type: "string",
							},
						},
						Description: "List of permissions",
					},
				},
				"rate_limit_per_minute": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Rate limit per minute",
						Minimum:     json.Number("1"),
					},
				},
				"rate_limit_per_hour": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Rate limit per hour",
						Minimum:     json.Number("1"),
					},
				},
				"expires_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Expiration timestamp",
						Format:      "date-time",
					},
				},
				"last_used_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last usage timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"is_active": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether the API key is active",
					},
				},
				"created_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Creation timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"updated_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last update timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
			},
			Required: []string{"id", "name", "permissions", "rate_limit_per_minute", "rate_limit_per_hour", "is_active"},
		},
	}

	// Success response schema
	o.doc.Components.Schemas["SuccessResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Response data",
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Success message",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "request_id", "timestamp"},
		},
	}
}

// addAuthEndpoints adds authentication endpoints
func (o *OpenAPIDoc) addAuthEndpoints() {
	// Register endpoint
	o.doc.Paths["/auth/register"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Authentication"},
			Summary:     "Register a new user",
			Description: "Create a new user account with email verification",
			OperationID: "registerUser",
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/RegisterUser",
			},
			Responses: openapi3.Responses{
				"201": {
					Value: &openapi3.Response{
						Description: "User registered successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"409": {
					Value: &openapi3.Response{
						Description: "Conflict - user already exists",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Login endpoint
	o.doc.Paths["/auth/login"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Authentication"},
			Summary:     "User login",
			Description: "Authenticate user and return JWT token",
			OperationID: "loginUser",
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/LoginUser",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Login successful",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/LoginResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Invalid credentials",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Refresh token endpoint
	o.doc.Paths["/auth/refresh"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Authentication"},
			Summary:     "Refresh JWT token",
			Description: "Get a new access token using refresh token",
			OperationID: "refreshToken",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/RefreshToken",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Token refreshed successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/TokenResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Invalid or expired refresh token",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Logout endpoint
	o.doc.Paths["/auth/logout"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Authentication"},
			Summary:     "User logout",
			Description: "Logout user and invalidate token",
			OperationID: "logoutUser",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Logout successful",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add request body schemas
	o.addAuthRequestBodies()
	o.addAuthResponseSchemas()
}

// addAuthRequestBodies adds authentication request body schemas
func (o *OpenAPIDoc) addAuthRequestBodies() {
	// Register user request body
	o.doc.Components.RequestBodies["RegisterUser"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "User registration information",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"username": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Username",
										MinLength:   json.Number("3"),
										MaxLength:   json.Number("50"),
									},
								},
								"email": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Email address",
										Format:      "email",
									},
								},
								"password": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Password",
										MinLength:   json.Number("8"),
										MaxLength:   json.Number("128"),
									},
								},
								"full_name": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Full name",
										MaxLength:   json.Number("100"),
									},
								},
								"phone": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Phone number",
										MaxLength:   json.Number("20"),
									},
								},
								"country": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Country code (ISO 3166-1 alpha-2)",
										MinLength:   json.Number("2"),
										MaxLength:   json.Number("2"),
									},
								},
							},
							Required: []string{"username", "email", "password", "country"},
						},
					},
				},
			},
		},
	}

	// Login user request body
	o.doc.Components.RequestBodies["LoginUser"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "User login credentials",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"username": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Username or email",
									},
								},
								"password": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Password",
									},
								},
							},
							Required: []string{"username", "password"},
						},
					},
				},
			},
		},
	}

	// Refresh token request body
	o.doc.Components.RequestBodies["RefreshToken"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "Refresh token",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"refresh_token": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Refresh token",
									},
								},
							},
							Required: []string{"refresh_token"},
						},
					},
				},
			},
		},
	}
}

// addAuthResponseSchemas adds authentication response schemas
func (o *OpenAPIDoc) addAuthResponseSchemas() {
	// Login response schema
	o.doc.Components.Schemas["LoginResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/AuthData",
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Success message",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Auth data schema
	o.doc.Components.Schemas["AuthData"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"access_token": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "JWT access token",
					},
				},
				"refresh_token": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "JWT refresh token",
					},
				},
				"token_type": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Token type",
						Enum:        []interface{}{"Bearer"},
					},
				},
				"expires_in": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Token expiration time in seconds",
					},
				},
				"user": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/User",
					},
				},
			},
			Required: []string{"access_token", "refresh_token", "token_type", "expires_in", "user"},
		},
	}

	// Token response schema
	o.doc.Components.Schemas["TokenResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"access_token": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "New JWT access token",
								},
							},
							"token_type": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Token type",
									Enum:        []interface{}{"Bearer"},
								},
							},
							"expires_in": {
								Value: &openapi3.Schema{
									Type:        "integer",
									Description: "Token expiration time in seconds",
								},
							},
						},
						Required: []string{"access_token", "token_type", "expires_in"},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}
}

// addUserEndpoints adds user management endpoints
func (o *OpenAPIDoc) addUserEndpoints() {
	// Get user profile
	o.doc.Paths["/users/profile"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Users"},
			Summary:     "Get user profile",
			Description: "Get the current user's profile information",
			OperationID: "getUserProfile",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "User profile retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		Put: &openapi3.Operation{
			Tags:        []string{"Users"},
			Summary:     "Update user profile",
			Description: "Update the current user's profile information",
			OperationID: "updateUserProfile",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/UpdateUserProfile",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "User profile updated successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Get user risk score
	o.doc.Paths["/users/risk-score"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Users"},
			Summary:     "Get user risk score",
			Description: "Get the current user's risk assessment score",
			OperationID: "getUserRiskScore",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "User risk score retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/RiskScoreResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Delete user account
	o.doc.Paths["/users/account"] = &openapi3.PathItem{
		Delete: &openapi3.Operation{
			Tags:        []string{"Users"},
			Summary:     "Delete user account",
			Description: "Permanently delete the current user's account",
			OperationID: "deleteUserAccount",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "User account deleted successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add user request body and response schemas
	o.addUserRequestBodies()
	o.addUserResponseSchemas()
}

// addUserRequestBodies adds user request body schemas
func (o *OpenAPIDoc) addUserRequestBodies() {
	// Update user profile request body
	o.doc.Components.RequestBodies["UpdateUserProfile"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "User profile update information",
			Required: false,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"full_name": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Full name",
										MaxLength:   json.Number("100"),
									},
								},
								"phone": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Phone number",
										MaxLength:   json.Number("20"),
									},
								},
								"country": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Country code (ISO 3166-1 alpha-2)",
										MinLength:   json.Number("2"),
										MaxLength:   json.Number("2"),
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// addUserResponseSchemas adds user response schemas
func (o *OpenAPIDoc) addUserResponseSchemas() {
	// Risk score response schema
	o.doc.Components.Schemas["RiskScoreResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"risk_score": {
								Value: &openapi3.Schema{
									Type:        "number",
									Description: "Risk score (0-1)",
									Minimum:     json.Number("0"),
									Maximum:     json.Number("1"),
								},
							},
							"risk_level": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Risk level",
									Enum:        []interface{}{"LOW", "MEDIUM", "HIGH"},
								},
							},
							"factors": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Value: &openapi3.Schema{
											Type: "string",
										},
									},
									Description: "Risk factors",
								},
							},
							"last_updated": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Last update timestamp",
									Format:      "date-time",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}
}

// addFraudDetectionEndpoints adds fraud detection endpoints
func (o *OpenAPIDoc) addFraudDetectionEndpoints() {
	// Analyze transaction endpoint
	o.doc.Paths["/fraud/analyze"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Fraud Detection"},
			Summary:     "Analyze transaction for fraud",
			Description: "Perform comprehensive fraud analysis on a transaction using AI and quantum computing",
			OperationID: "analyzeTransaction",
			Security: map[string][]interface{}{
				"apiKeyAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/AnalyzeTransaction",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Transaction analyzed successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/FraudAnalysisResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized - invalid API key",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"429": {
					Value: &openapi3.Response{
						Description: "Rate limit exceeded",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Batch analyze transactions endpoint
	o.doc.Paths["/fraud/batch-analyze"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Fraud Detection"},
			Summary:     "Batch analyze transactions",
			Description: "Analyze multiple transactions in a single request",
			OperationID: "batchAnalyzeTransactions",
			Security: map[string][]interface{}{
				"apiKeyAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/BatchAnalyzeTransactions",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Transactions analyzed successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/BatchAnalysisResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized - invalid API key",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Get fraud rules
	o.doc.Paths["/fraud/rules"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Fraud Detection"},
			Summary:     "List fraud detection rules",
			Description: "Get a list of all fraud detection rules",
			OperationID: "listFraudRules",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "page",
					In:          "query",
					Description: "Page number",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 1,
							Minimum: 1,
						},
					},
				},
				{
					Name:        "per_page",
					In:          "query",
					Description: "Items per page",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 20,
							Minimum: 1,
							Maximum: 100,
						},
					},
				},
				{
					Name:        "active_only",
					In:          "query",
					Description: "Filter by active status",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "boolean",
							Default: true,
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Fraud rules retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/FraudRulesListResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		Post: &openapi3.Operation{
			Tags:        []string{"Fraud Detection"},
			Summary:     "Create fraud detection rule",
			Description: "Create a new fraud detection rule",
			OperationID: "createFraudRule",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/CreateFraudRule",
			},
			Responses: openapi3.Responses{
				"201": {
					Value: &openapi3.Response{
						Description: "Fraud rule created successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/FraudRuleResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add fraud detection request body and response schemas
	o.addFraudDetectionRequestBodies()
	o.addFraudDetectionResponseSchemas()
}

// addFraudDetectionRequestBodies adds fraud detection request body schemas
func (o *OpenAPIDoc) addFraudDetectionRequestBodies() {
	// Analyze transaction request body
	o.doc.Components.RequestBodies["AnalyzeTransaction"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "Transaction to analyze for fraud",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"transaction_id": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Unique transaction identifier",
										MaxLength:   json.Number("255"),
									},
								},
								"user_id": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "User ID",
										Format:      "uuid",
									},
								},
								"merchant_id": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Merchant ID",
										Format:      "uuid",
									},
								},
								"amount": {
									Value: &openapi3.Schema{
										Type:        "number",
										Description: "Transaction amount",
										Minimum:     json.Number("0.01"),
										Maximum:     json.Number("999999.99"),
									},
								},
								"currency": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Currency code (ISO 4217)",
										MinLength:   json.Number("3"),
										MaxLength:   json.Number("3"),
									},
								},
								"description": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Transaction description",
										MaxLength:   json.Number("500"),
									},
								},
								"payment_method": {
									Value: &openapi3.SchemaRef{
										Ref: "#/components/schemas/PaymentMethod",
									},
								},
								"location": {
									Value: &openapi3.SchemaRef{
										Ref: "#/components/schemas/Location",
									},
								},
								"device": {
									Value: &openapi3.SchemaRef{
										Ref: "#/components/schemas/Device",
									},
								},
								"customer_data": {
									Value: &openapi3.Schema{
										Type:        "object",
										Description: "Additional customer data for analysis",
									},
								},
								"request_ai_analysis": {
									Value: &openapi3.Schema{
										Type:        "boolean",
										Description: "Request AI analysis",
										Default:     false,
									},
								},
								"request_quantum_analysis": {
									Value: &openapi3.Schema{
										Type:        "boolean",
										Description: "Request quantum computing analysis",
										Default:     false,
									},
								},
							},
							Required: []string{"transaction_id", "user_id", "merchant_id", "amount", "currency"},
						},
					},
				},
			},
		},
	}

	// Batch analyze transactions request body
	o.doc.Components.RequestBodies["BatchAnalyzeTransactions"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "Multiple transactions to analyze for fraud",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"transactions": {
									Value: &openapi3.Schema{
										Type: "array",
										Items: &openapi3.SchemaRef{
											Ref: "#/components/schemas/Transaction",
										},
										Description: "List of transactions to analyze",
									},
								},
								"analysis_options": {
									Value: &openapi3.Schema{
										Type: "object",
										Properties: map[string]*openapi3.SchemaRef{
											"ai_enabled": {
												Value: &openapi3.Schema{
													Type:    "boolean",
													Default: true,
												},
											},
											"quantum_enabled": {
												Value: &openapi3.Schema{
													Type:    "boolean",
													Default: false,
												},
											},
											"batch_mode": {
												Value: &openapi3.Schema{
													Type:    "boolean",
													Default: true,
												},
											},
										},
									},
								},
							},
							Required: []string{"transactions"},
						},
					},
				},
			},
		},
	}

	// Create fraud rule request body
	o.doc.Components.RequestBodies["CreateFraudRule"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "Fraud detection rule to create",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"name": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Rule name",
										MaxLength:   json.Number("255"),
									},
								},
								"description": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Rule description",
										MaxLength:   json.Number("1000"),
									},
								},
								"rule_type": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Rule type",
										Enum:        []interface{}{"threshold", "pattern", "ml_model", "custom"},
									},
								},
								"conditions": {
									Value: &openapi3.Schema{
										Type:        "object",
										Description: "Rule conditions",
									},
								},
								"actions": {
									Value: &openapi3.Schema{
										Type:        "object",
										Description: "Actions to take when rule matches",
									},
								},
								"priority": {
									Value: &openapi3.Schema{
										Type:        "integer",
										Description: "Rule priority (lower = higher priority)",
										Default:     100,
									},
								},
								"is_active": {
									Value: &openapi3.Schema{
										Type:        "boolean",
										Description: "Whether the rule is active",
										Default:     true,
									},
								},
							},
							Required: []string{"name", "rule_type", "conditions", "actions"},
						},
					},
				},
			},
		},
	}

	// Payment method schema
	o.doc.Components.Schemas["PaymentMethod"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"type": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Payment method type",
						Enum:        []interface{}{"credit_card", "debit_card", "bank_transfer", "digital_wallet", "crypto"},
					},
				},
				"last_four": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last 4 digits of card/account",
						MinLength:   json.Number("4"),
						MaxLength:   json.Number("4"),
					},
				},
				"provider": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Payment provider",
						MaxLength:   json.Number("100"),
					},
				},
			},
			Required: []string{"type"},
		},
	}
}

// addFraudDetectionResponseSchemas adds fraud detection response schemas
func (o *OpenAPIDoc) addFraudDetectionResponseSchemas() {
	// Fraud analysis response schema
	o.doc.Components.Schemas["FraudAnalysisResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/FraudAnalysis",
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Success message",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Batch analysis response schema
	o.doc.Components.Schemas["BatchAnalysisResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"batch_id": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Batch analysis ID",
									Format:      "uuid",
								},
							},
							"results": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Ref: "#/components/schemas/FraudAnalysis",
									},
									Description: "Analysis results for each transaction",
								},
							},
							"summary": {
								Value: &openapi3.Schema{
									Type: "object",
									Properties: map[string]*openapi3.SchemaRef{
										"total_transactions": {
											Value: &openapi3.Schema{
												Type: "integer",
											},
										},
										"high_risk_count": {
											Value: &openapi3.Schema{
												Type: "integer",
											},
										},
										"medium_risk_count": {
											Value: &openapi3.Schema{
												Type: "integer",
											},
										},
										"low_risk_count": {
											Value: &openapi3.Schema{
												Type: "integer",
											},
										},
										"avg_fraud_score": {
											Value: &openapi3.Schema{
												Type: "number",
											},
										},
										"processing_time_ms": {
											Value: &openapi3.Schema{
												Type: "integer",
											},
										},
									},
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Fraud rule response schema
	o.doc.Components.Schemas["FraudRuleResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"id": {
								Value: &openapi3.Schema{
									Type: "string",
									Format: "uuid",
								},
							},
							"name": {
								Value: &openapi3.Schema{
									Type: "string",
								},
							},
							"description": {
								Value: &openapi3.Schema{
									Type: "string",
								},
							},
							"rule_type": {
								Value: &openapi3.Schema{
									Type: "string",
								},
							},
							"conditions": {
								Value: &openapi3.Schema{
									Type: "object",
								},
							},
							"actions": {
								Value: &openapi3.Schema{
									Type: "object",
								},
							},
							"priority": {
								Value: &openapi3.Schema{
									Type: "integer",
								},
							},
							"is_active": {
								Value: &openapi3.Schema{
									Type: "boolean",
								},
							},
							"created_at": {
								Value: &openapi3.Schema{
									Type: "string",
									Format: "date-time",
								},
							},
						},
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type: "string",
						Description: "Success message",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Fraud rules list response schema
	o.doc.Components.Schemas["FraudRulesListResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"rules": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Ref: "#/components/schemas/FraudRule",
									},
								},
							},
							"pagination": {
								Value: &openapi3.SchemaRef{
									Ref: "#/components/schemas/Pagination",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Fraud rule schema
	o.doc.Components.Schemas["FraudRule"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Rule ID",
						Format:      "uuid",
						ReadOnly:    true,
					},
				},
				"name": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Rule name",
					},
				},
				"description": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Rule description",
					},
				},
				"rule_type": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Rule type",
						Enum:        []interface{}{"threshold", "pattern", "ml_model", "custom"},
					},
				},
				"conditions": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Rule conditions",
					},
				},
				"actions": {
					Value: &openapi3.Schema{
						Type:        "object",
						Description: "Actions to take when rule matches",
					},
				},
				"priority": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Rule priority",
					},
				},
				"is_active": {
					Value: &openapi3.Schema{
						Type:        "boolean",
						Description: "Whether the rule is active",
					},
				},
				"created_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Creation timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
				"updated_at": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Last update timestamp",
						Format:      "date-time",
						ReadOnly:    true,
					},
				},
			},
			Required: []string{"id", "name", "rule_type", "conditions", "actions", "priority", "is_active"},
		},
	}
}

// addAPIManagementEndpoints adds API key management endpoints
func (o *OpenAPIDoc) addAPIManagementEndpoints() {
	// List API keys
	o.doc.Paths["/api/keys"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"API Management"},
			Summary:     "List API keys",
			Description: "Get a list of API keys for the authenticated user",
			OperationID: "listAPIKeys",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "page",
					In:          "query",
					Description: "Page number",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 1,
							Minimum: 1,
						},
					},
				},
				{
					Name:        "per_page",
					In:          "query",
					Description: "Items per page",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 20,
							Minimum: 1,
							Maximum: 100,
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "API keys retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/APIKeysListResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		Post: &openapi3.Operation{
			Tags:        []string{"API Management"},
			Summary:     "Create API key",
			Description: "Create a new API key for the authenticated user",
			OperationID: "createAPIKey",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/CreateAPIKey",
			},
			Responses: openapi3.Responses{
				"201": {
					Value: &openapi3.Response{
						Description: "API key created successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/APIKeyResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Get API key details
	o.doc.Paths["/api/keys/{id}"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"API Management"},
			Summary:     "Get API key details",
			Description: "Get details of a specific API key",
			OperationID: "getAPIKey",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "id",
					In:          "path",
					Description: "API key ID",
					Required:    true,
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:   "string",
							Format: "uuid",
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "API key details retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/APIKeyResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"404": {
					Value: &openapi3.Response{
						Description: "API key not found",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		Put: &openapi3.Operation{
			Tags:        []string{"API Management"},
			Summary:     "Update API key",
			Description: "Update an existing API key",
			OperationID: "updateAPIKey",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "id",
					In:          "path",
					Description: "API key ID",
					Required:    true,
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:   "string",
							Format: "uuid",
						},
					},
				},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/UpdateAPIKey",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "API key updated successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/APIKeyResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Bad request - validation error",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"404": {
					Value: &openapi3.Response{
						Description: "API key not found",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		Delete: &openapi3.Operation{
			Tags:        []string{"API Management"},
			Summary:     "Delete API key",
			Description: "Delete an existing API key",
			OperationID: "deleteAPIKey",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "id",
					In:          "path",
					Description: "API key ID",
					Required:    true,
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:   "string",
							Format: "uuid",
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "API key deleted successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"404": {
					Value: &openapi3.Response{
						Description: "API key not found",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add API management request body and response schemas
	o.addAPIManagementRequestBodies()
	o.addAPIManagementResponseSchemas()
}

// addAPIManagementRequestBodies adds API management request body schemas
func (o *OpenAPIDoc) addAPIManagementRequestBodies() {
	// Create API key request body
	o.doc.Components.RequestBodies["CreateAPIKey"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "API key to create",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"name": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "API key name",
										MaxLength:   json.Number("255"),
									},
								},
								"description": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "API key description",
										MaxLength:   json.Number("1000"),
									},
								},
								"permissions": {
									Value: &openapi3.Schema{
										Type: "array",
										Items: &openapi3.SchemaRef{
											Value: &openapi3.Schema{
												Type: "string",
											},
										},
										Description: "List of permissions",
									},
								},
								"rate_limit_per_minute": {
									Value: &openapi3.Schema{
										Type:        "integer",
										Description: "Rate limit per minute",
										Minimum:     json.Number("1"),
										Default:     json.Number("1000"),
									},
								},
								"rate_limit_per_hour": {
									Value: &openapi3.Schema{
										Type:        "integer",
										Description: "Rate limit per hour",
										Minimum:     json.Number("1"),
										Default:     json.Number("100000"),
									},
								},
								"expires_at": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Expiration timestamp",
										Format:      "date-time",
									},
								},
							},
							Required: []string{"name", "permissions", "rate_limit_per_minute", "rate_limit_per_hour"},
						},
					},
				},
			},
		},
	}

	// Update API key request body
	o.doc.Components.RequestBodies["UpdateAPIKey"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "API key updates",
			Required: false,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"name": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "API key name",
										MaxLength:   json.Number("255"),
									},
								},
								"description": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "API key description",
										MaxLength:   json.Number("1000"),
									},
								},
								"permissions": {
									Value: &openapi3.Schema{
										Type: "array",
										Items: &openapi3.SchemaRef{
											Value: &openapi3.Schema{
												Type: "string",
											},
										},
										Description: "List of permissions",
									},
								},
								"rate_limit_per_minute": {
									Value: &openapi3.Schema{
										Type:        "integer",
										Description: "Rate limit per minute",
										Minimum:     json.Number("1"),
									},
								},
								"rate_limit_per_hour": {
									Value: &openapi3.Schema{
										Type:        "integer",
										Description: "Rate limit per hour",
										Minimum:     json.Number("1"),
									},
								},
								"expires_at": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Expiration timestamp",
										Format:      "date-time",
									},
								},
								"is_active": {
									Value: &openapi3.Schema{
										Type:        "boolean",
										Description: "Whether the API key is active",
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// addAPIManagementResponseSchemas adds API management response schemas
func (o *OpenAPIDoc) addAPIManagementResponseSchemas() {
	// API key response schema
	o.doc.Components.Schemas["APIKeyResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.SchemaRef{
						Ref: "#/components/schemas/APIKey",
					},
				},
				"message": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Success message",
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// API keys list response schema
	o.doc.Components.Schemas["APIKeysListResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"keys": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Ref: "#/components/schemas/APIKey",
									},
								},
							},
							"pagination": {
								Value: &openapi3.SchemaRef{
									Ref: "#/components/schemas/Pagination",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}
}

// addAdminEndpoints adds admin endpoints
func (o *OpenAPIDoc) addAdminEndpoints() {
	// Get system health
	o.doc.Paths["/admin/health"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Administration"},
			Summary:     "Get system health",
			Description: "Get comprehensive system health status",
			OperationID: "getSystemHealth",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "System health retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SystemHealthResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Get system metrics
	o.doc.Paths["/admin/metrics"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Administration"},
			Summary:     "Get system metrics",
			Description: "Get comprehensive system metrics and analytics",
			OperationID: "getSystemMetrics",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "time_range",
					In:          "query",
					Description: "Time range for metrics",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "string",
							Enum: []interface{}{"1h", "6h", "24h", "7d", "30d"},
							Default: "24h",
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "System metrics retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SystemMetricsResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Get users list
	o.doc.Paths["/admin/users"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Administration"},
			Summary:     "List users",
			Description: "Get a list of all users in the system",
			OperationID: "listUsers",
			Security: map[string][]interface{}{
				"bearerAuth": {},
			},
			Parameters: []*openapi3.Parameter{
				{
					Name:        "page",
					In:          "query",
					Description: "Page number",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 1,
							Minimum: 1,
						},
					},
				},
				{
					Name:        "per_page",
					In:          "query",
					Description: "Items per page",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:    "integer",
							Default: 20,
							Minimum: 1,
							Maximum: 100,
						},
					},
				},
				{
					Name:        "status",
					In:          "query",
					Description: "Filter by status",
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "string",
							Enum: []interface{}{"active", "suspended", "closed", "frozen"},
						},
					},
				},
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Users list retrieved successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/UsersListResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Unauthorized",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add admin response schemas
	o.addAdminResponseSchemas()
}

// addAdminResponseSchemas adds admin response schemas
func (o *OpenAPIDoc) addAdminResponseSchemas() {
	// System health response schema
	o.doc.Components.Schemas["SystemHealthResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"overall": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Overall health status",
									Enum:        []interface{}{"healthy", "degraded", "unhealthy"},
								},
							},
							"services": {
								Value: &openapi3.Schema{
									Type: "object",
									Description: "Health status of individual services",
								},
							},
							"checks": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Value: &openapi3.Schema{
											Type: "object",
										},
									},
								},
							},
							"timestamp": {
								Value: &openapi3.Schema{
									Type:        "string",
									Description: "Health check timestamp",
									Format:      "date-time",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// System metrics response schema
	o.doc.Components.Schemas["SystemMetricsResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"overview": {
								Value: &openapi3.Schema{
									Type: "object",
									Description: "System overview metrics",
								},
							},
							"performance": {
								Value: &openapi3.Schema{
									Type: "object",
									Description: "Performance metrics",
								},
							},
							"usage": {
								Value: &openapi3.Schema{
									Type: "object",
									Description: "Usage metrics",
								},
							},
							"fraud_detection": {
								Value: &openapi3.Schema{
									Type: "object",
									Description: "Fraud detection metrics",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}

	// Users list response schema
	o.doc.Components.Schemas["UsersListResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Response status",
						Enum:        []interface{}{"success"},
					},
				},
				"data": {
					Value: &openapi3.Schema{
						Type: "object",
						Properties: map[string]*openapi3.SchemaRef{
							"users": {
								Value: &openapi3.Schema{
									Type: "array",
									Items: &openapi3.SchemaRef{
										Ref: "#/components/schemas/User",
									},
								},
							},
							"pagination": {
								Value: &openapi3.SchemaRef{
									Ref: "#/components/schemas/Pagination",
								},
							},
						},
					},
				},
				"request_id": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Unique request identifier",
						Format:      "uuid",
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "integer",
						Description: "Unix timestamp",
						Format:      "int64",
					},
				},
			},
			Required: []string{"status", "data", "request_id", "timestamp"},
		},
	}
}

// addMonitoringEndpoints adds monitoring endpoints
func (o *OpenAPIDDoc) addMonitoringEndpoints() {
	// Health check endpoint
	o.doc.Paths["/health"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Monitoring"},
			Summary:     "Health check",
			Description: "Basic health check endpoint",
			OperationID: "healthCheck",
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Service is healthy",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/HealthCheckResponse",
								},
							},
						},
					},
				},
				"503": {
					Value: &openapi3.Response{
						Description: "Service is unhealthy",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Metrics endpoint
	o.doc.Paths["/metrics"] = &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:        []string{"Monitoring"},
			Summary:     "Get metrics",
			Description: "Get Prometheus metrics",
			OperationID: "getMetrics",
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Metrics data",
						Content: map[string]openapi3.MediaType{
							"text/plain": {
								Schema: &openapi3.Schema{
									Type: "string",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add monitoring response schemas
	o.addMonitoringResponseSchemas()
}

// addMonitoringResponseSchemas adds monitoring response schemas
func (o *OpenAPIDoc) addMonitoringResponseSchemas() {
	// Health check response schema
	o.doc.Components.Schemas["HealthCheckResponse"] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type: "object",
			Properties: map[string]*openapi3.SchemaRef{
				"status": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Health status",
						Enum:        []interface{}{"healthy", "unhealthy", "degraded"},
					},
				},
				"timestamp": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "Health check timestamp",
						Format:      "date-time",
					},
				"version": {
					Value: &openapi3.Schema{
						Type:        "string",
						Description: "API version",
					},
				},
				"checks": {
					Value: &openapi3.Schema{
						Type: "object",
						Description: "Health check results",
					},
				},
			},
			Required: []string{"status", "timestamp", "version"},
		},
	}
}

// addWebhookEndpoints adds webhook endpoints
func (o *OpenAPIDoc) addWebhookEndpoints() {
	// Webhook endpoint
	o.doc.Paths["/webhooks"] = &openapi3.PathItem{
		Post: &openapi3.Operation{
			Tags:        []string{"Webhooks"},
			Summary:     "Handle webhook",
			Description: "Process incoming webhook notifications",
			OperationID: "handleWebhook",
			Parameters: []*openapi3.Parameter{
				{
					Name:        "X-Webhook-Signature",
					In:          "header",
					Description: "Webhook signature for verification",
					Required:    false,
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "string",
						},
					},
				},
			},
			RequestBody: &openapi3.RequestBodyRef{
				Ref: "#/components/requestBodies/WebhookPayload",
			},
			Responses: openapi3.Responses{
				"200": {
					Value: &openapi3.Response{
						Description: "Webhook processed successfully",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/SuccessResponse",
								},
							},
						},
					},
				},
				"400": {
					Value: &openapi3.Response{
						Description: "Invalid webhook payload",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
				"401": {
					Value: &openapi3.Response{
						Description: "Invalid webhook signature",
						Content: openapi3.Content{
							"application/json": {
								Schema: &openapi3.SchemaRef{
									Ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
	}

	// Add webhook request body schemas
	o.addWebhookRequestBodies()
}

// addWebhookRequestBodies adds webhook request body schemas
func (o *OpenAPIDoc) addWebhookRequestBodies() {
	// Webhook payload request body
	o.doc.Components.RequestBodies["WebhookPayload"] = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: "Webhook event payload",
			Required: true,
			Content: openapi3.Content{
				"application/json": {
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type: "object",
							Properties: map[string]*openapi3.SchemaRef{
								"event": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Event type",
									},
								},
								"timestamp": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Event timestamp",
										Format:      "date-time",
									},
								},
								"data": {
									Value: &openapi3.Schema{
										Type:        "object",
										Description: "Event data",
									},
								},
								"signature": {
									Value: &openapi3.Schema{
										Type:        "string",
										Description: "Webhook signature",
									},
								},
							},
							Required: []string{"event", "timestamp", "data"},
						},
					},
				},
			},
		},
	}
}

// addTags adds tags to the documentation
func (o *OpenAPIDoc) addTags() {
	o.doc.Tags = []*openapi3.Tag{
		{
			Name:        "Authentication",
			Description: "User authentication and authorization",
		},
		{
			Name:        "Users",
			Description: "User management operations",
		},
		{
			Name:        "Fraud Detection",
			Description: "Fraud detection and analysis services",
		},
		{
			Name:        "API Management",
			Description: "API key management",
		},
		{
			Name:        "Administration",
			Description: "System administration operations",
		},
		{
			Name:        "Monitoring",
			Description: "System monitoring and health checks",
		},
		{
			Name:        "Webhooks",
			Description: "Webhook event handling",
		},
	}
}

// ExportJSON exports the OpenAPI documentation as JSON
func (o *OpenAPIDoc) ExportJSON() ([]byte, error) {
	return o.doc.MarshalJSON()
}

// ExportYAML exports the OpenAPI documentation as YAML
func (o *OpenAPIDoc) ExportYAML() ([]byte, error) {
	return o.doc.MarshalYAML()
}

// SaveToFile saves the OpenAPI documentation to a file
func (o *OpenAPIDoc) SaveToFile(filename string) error {
	jsonData, err := o.ExportJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal OpenAPI doc: %w", err)
	}

	// Convert JSON to YAML format for better readability
	var doc map[string]interface{}
	if err := json.Unmarshal(jsonData, &doc); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	yamlData, err := yaml.Marshal(doc)
	if err != nil {
		return fmt.Errorf("failed to marshal YAML: %w", err)
	}

	return os.WriteFile(filename, yamlData, 0644)
}

// GenerateExampleUsage generates example usage documentation
func (o *OpenAPIDDoc) GenerateExampleUsage() string {
	return `
# QuantumBeam API Usage Examples

This document provides examples of how to use the QuantumBeam API.

## Authentication

### User Registration
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "john_doe",
    "email": "john.doe@example.com",
    "password": "SecurePassword123!",
    "full_name": "John Doe",
    "country": "US"
  }'
\`\`\`

### User Login
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "john_doe",
    "password": "SecurePassword123!"
  }'
\`\`\`

### Using JWT Token
\`\`\`bash
curl -X GET https://api.quantumbeam.io/v1/users/profile \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
\`\`\`

## API Key Authentication

### Create API Key
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/api/keys \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My API Key",
    "description": "Key for production use",
    "permissions": ["read", "write", "fraud_analysis"],
    "rate_limit_per_minute": 1000,
    "rate_limit_per_hour": 100000
  }'
\`\`\`

### Using API Key
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/fraud/analyze \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "txn_123456",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 150.00,
    "currency": "USD",
    "description": "Test transaction"
  }'
\`\`\`

## Fraud Detection

### Analyze Single Transaction
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/fraud/analyze \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction_id": "txn_123456",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 150.00,
    "currency": "USD",
    "description": "Online purchase",
    "payment_method": {
      "type": "credit_card",
      "last_four": "1234",
      "provider": "visa"
    },
    "location": {
      "lat": 40.7128,
      "lng": -74.0060,
      "country": "US",
      "city": "New York"
    },
    "device": {
      "fingerprint": "device_fp_abc123",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    "request_ai_analysis": true,
    "request_quantum_analysis": false
  }'
\`\`\`

### Batch Analysis
\`\`\`bash
curl -X POST https://api.quantumbeam.io/v1/fraud/batch-analyze \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transactions": [
      {
        "transaction_id": "txn_001",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
        "amount": 100.00,
        "currency": "USD"
      },
      {
        "transaction_id": "txn_002",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
        "amount": 250.00,
        "currency": "USD"
      }
    ],
    "analysis_options": {
      "ai_enabled": true,
      "quantum_enabled": false,
      "batch_mode": true
    }
  }'
\`\`\`

## Error Handling

All API errors follow a consistent format:

\`\`\`json
{
  "status": "error",
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "code": "BAD_REQUEST",
  "details": {
    "field": "amount",
    "error": "must be greater than 0"
  },
  "request_id": "req_123456789",
  "timestamp": 1640995200,
  "path": "/v1/fraud/analyze",
  "method": "POST"
}
\`\`\`

## Rate Limiting

API requests are rate limited. Rate limit headers are included in responses:

\`\`\`http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995800
\`\`\`

When rate limits are exceeded, the API returns a 429 status code.

## Security Notes

- Always use HTTPS in production
- Never expose API keys or JWT tokens in client-side code
- Validate webhook signatures using the provided secret
- Implement proper error handling and retry logic
`
}

// GenerateMarkdownDocumentation generates markdown documentation
func (o *OpenAPIDoc) GenerateMarkdownDocumentation() string {
	doc := o.doc

	var md strings.Builder

	md.WriteString("# QuantumBeam API Documentation\n\n")
	md.WriteString("This document provides comprehensive API documentation for the QuantumBeam fraud detection platform.\n\n")

	// Add overview
	md.WriteString("## Overview\n\n")
	md.WriteString(fmt.Sprintf("**Version:** %s\n", doc.Info.Version))
	md.WriteString(fmt.Sprintf("**Description:** %s\n\n", doc.Info.Description))
	md.WriteString(fmt.Sprintf("**Terms of Service:** [%s](%s)\n\n", doc.Info.TermsOfService, doc.Info.TermsOfService))
	md.WriteString(fmt.Sprintf("**License:** [%s](%s)\n\n", doc.Info.License.Name, doc.Info.License.URL))

	// Add servers
	md.WriteString("## Servers\n\n")
	for _, server := range doc.Servers {
		md.WriteString(fmt.Sprintf("- **%s:** `%s`\n", server.Description, server.URL))
	}
	md.WriteString("\n")

	// Add security
	md.WriteString("## Security\n\n")
	md.WriteString("### Authentication Methods\n\n")
	for schemeName, schemeRef := range doc.Components.SecuritySchemes {
		scheme := schemeRef.Value
		md.WriteString(fmt.Sprintf("- **%s:** %s - %s\n", schemeName, scheme.Type, scheme.Description))
	}
	md.WriteString("\n")

	// Add tags
	md.WriteString("## API Endpoints\n\n")
	for _, tag := range doc.Tags {
		md.WriteString(fmt.Sprintf("### %s\n\n%s\n\n", tag.Name, tag.Description))
	}

	// Add paths
	md.WriteString("## Endpoints\n\n")
	for path, pathItem := range doc.Paths {
		if pathItem.Get != nil {
			md.WriteString(fmt.Sprintf("### %s\n\n", path))
			md.WriteString(fmt.Sprintf("**%s:** %s\n\n", pathItem.Get.Summary, pathItem.Get.Description))

			// Add parameters
			if len(pathItem.Get.Parameters) > 0 {
				md.WriteString("**Parameters:**\n")
				for _, param := range pathItem.Get.Parameters {
					required := ""
					if param.Required {
						required = " (required)"
					}
					md.WriteString(fmt.Sprintf("- `%s`%s: %s\n", param.Name, required, param.Description))
				}
				md.WriteString("\n")
			}

			// Add request body
			if pathItem.Get.RequestBody != nil {
				md.WriteString("**Request Body:**\n")
				md.WriteString("```json\n")
				// Add request body schema
				md.WriteString("See schema for details\n")
				md.WriteString("```\n\n")
			}

			// Add responses
			md.WriteString("**Responses:**\n")
			for status, response := range pathItem.Get.Responses {
				md.WriteString(fmt.Sprintf("- **%d:** %s\n", status, response.Description))
			}
			md.WriteString("\n")
		}
	}

	// Add data models
	md.WriteString("## Data Models\n\n")
	md.WriteString("### Common Types\n\n")
	md.WriteString("- **[ErrorResponse](#component-schemas-ErrorResponse)** - Standard error response format\n")
	md.WriteString("- **[Pagination](#component-schemas-Pagination)** - Pagination information\n")
	md.WriteString("- **[SuccessResponse](#component-schemas-SuccessResponse)** - Standard success response format\n\n")
	md.WriteString("### Core Entities\n\n")
	md.WriteString("- **[User](#component-schemas-User)** - User entity\n")
	md.WriteString("- **[Transaction](#component-schemas-Transaction)** - Transaction entity\n")
	md.WriteString("- **[Location](#component-schemas-Location)** - Location information\n")
	md.WriteString("- **[Device](#component-schemas-Device)** - Device information\n")
	md.WriteString("- **[APIKey](#component-schemas-APIKey)** - API key entity\n\n")
	md.WriteString("### Analysis Types\n\n")
	md.WriteString("- **[FraudAnalysis](#component-schemas-FraudAnalysis)** - Fraud analysis results\n")
	md.WriteString("- **[AIAnalysis](#component-schemas-AIAnalysis)** - AI analysis details\n")
	md.WriteString("- **[QuantumAnalysis](#component-schemas-QuantumAnalysis)** - Quantum analysis results\n\n")

	md.WriteString("\n---\n")
	md.WriteString("*Last updated: " + time.Now().Format(time.RFC3339) + "*\n")

	return md.String()
}

// ValidateDocumentation validates the OpenAPI documentation
func (o *OpenAPIDDoc) ValidateDocumentation() error {
	// Validate the OpenAPI document
	loader := openapi3.NewLoader()
	return loader.LoadFromData(o.doc)
}

// AddExternalDocs adds external documentation references
func (o *OpenAPIDDoc) AddExternalDocs(url, description string) {
	if o.doc.ExternalDocs == nil {
		o.doc.ExternalDocs = &openapi3.ExternalDocumentation{}
	}
	o.doc.ExternalDocs.URL = url
	o.doc.ExternalDocs.Description = description
}

// SetInfo sets the API info
func (o *OpenAPIDoc) SetInfo(title, description, version string) {
	o.doc.Info.Title = title
	o.doc.Info.Description = description
	o.doc.Info.Version = version
}

// AddServer adds a server configuration
func (o *OpenAPIDoc) AddServer(url, description string) {
	server := &openapi3.Server{
		URL:         url,
		Description: description,
	}
	o.doc.Servers = append(o.doc.Servers, server)
}

// SetLicense sets the license information
func (o *OpenAPIDoc) SetLicense(name, url string) {
	if o.doc.Info.License == nil {
		o.doc.Info.License = &openapi3.License{}
	}
	o.doc.Info.License.Name = name
	o.doc.Info.License.URL = url
}

// SetContact sets the contact information
func (o *OpenAPIDoc) SetContact(name, email, url string) {
	if o.doc.Info.Contact == nil {
		o.doc.Info.Contact = &openapi3.Contact{}
	}
	o.doc.Info.Contact.Name = name
	o.doc.Info.Contact.Email = email
	o.doc.Info.Contact.URL = url
}