//go:build ignore

package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers/legacy"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewValidationMiddleware(t *testing.T) {
	// Create a simple OpenAPI spec
	spec := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   "Test API",
			Version: "1.0.0",
		},
		Paths: openapi3.Paths{
			"/test": &openapi3.PathItem{
				Get: &openapi3.Operation{
					OperationID: "testOperation",
					Responses: openapi3.Responses{
						"200": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "Success",
							},
						},
					},
				},
			},
		},
	}

	config := ValidationConfig{
		SpecLoader:               spec,
		EnableRequestValidation:  true,
		EnableResponseValidation: false,
		StrictMode:               false,
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests

	mw, err := NewValidationMiddleware(config, logger)
	require.NoError(t, err)
	require.NotNil(t, mw)

	assert.Equal(t, spec, mw.doc)
	assert.NotNil(t, mw.router)
}

func TestValidationMiddleware_SkipValidation(t *testing.T) {
	spec := createTestSpec()
	config := ValidationConfig{
		SpecLoader:               spec,
		EnableRequestValidation:  true,
		EnableResponseValidation: true,
		StrictMode:               false,
		SkipPaths:                []string{"/health", "/metrics"},
		SkipMethods:              []string{"OPTIONS"},
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw, err := NewValidationMiddleware(config, logger)
	require.NoError(t, err)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	tests := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
	}{
		{
			name:           "Skip path",
			method:         "GET",
			path:           "/health",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Skip method",
			method:         "OPTIONS",
			path:           "/test",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Don't skip",
			method:         "GET",
			path:           "/test",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestValidationMiddleware_ValidateRequest(t *testing.T) {
	spec := createTestSpecWithRequestBody()
	config := ValidationConfig{
		SpecLoader:               spec,
		EnableRequestValidation:  true,
		EnableResponseValidation: false,
		StrictMode:               true,
		CustomValidators:         DefaultCustomValidators(),
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw, err := NewValidationMiddleware(config, logger)
	require.NoError(t, err)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	tests := []struct {
		name           string
		method         string
		path           string
		body           interface{}
		expectedStatus int
		shouldContain  []string
	}{
		{
			name:   "Valid request",
			method: "POST",
			path:   "/users",
			body: map[string]interface{}{
				"email":     "test@example.com",
				"password":  "SecurePass123!",
				"tenant_id": "550e8400-e29b-41d4-a716-446655440000",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:   "Invalid email",
			method: "POST",
			path:   "/users",
			body: map[string]interface{}{
				"email":     "invalid-email",
				"password":  "SecurePass123!",
				"tenant_id": "550e8400-e29b-41d4-a716-446655440000",
			},
			expectedStatus: http.StatusBadRequest,
			shouldContain:  []string{"validation failed"},
		},
		{
			name:   "Weak password",
			method: "POST",
			path:   "/users",
			body: map[string]interface{}{
				"email":     "test@example.com",
				"password":  "weak",
				"tenant_id": "550e8400-e29b-41d4-a716-446655440000",
			},
			expectedStatus: http.StatusBadRequest,
			shouldContain:  []string{"password must contain"},
		},
		{
			name:   "Invalid UUID",
			method: "POST",
			path:   "/users",
			body: map[string]interface{}{
				"email":     "test@example.com",
				"password":  "SecurePass123!",
				"tenant_id": "invalid-uuid",
			},
			expectedStatus: http.StatusBadRequest,
			shouldContain:  []string{"invalid tenant ID format"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body bytes.Buffer
			if tt.body != nil {
				require.NoError(t, json.NewEncoder(&body).Encode(tt.body))
			}

			req := httptest.NewRequest(tt.method, tt.path, &body)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			for _, contain := range tt.shouldContain {
				assert.Contains(t, w.Body.String(), contain)
			}
		})
	}
}

func TestCustomValidators(t *testing.T) {
	t.Run("EmailValidator", func(t *testing.T) {
		tests := []struct {
			email   string
			isValid bool
		}{
			{"test@example.com", true},
			{"user.name+tag@domain.co.uk", true},
			{"invalid-email", false},
			{"@domain.com", false},
			{"user@", false},
		}

		for _, tt := range tests {
			err := EmailValidator(tt.email, nil)
			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "invalid email format")
			}
		}
	})

	t.Run("PasswordValidator", func(t *testing.T) {
		tests := []struct {
			password string
			isValid  bool
		}{
			{"SecurePass123!", true},
			{"weakpass", false},
			{"NoNumbers!", false},
			{"nouppercase123!", false},
			{"NOLOWERCASE123!", false},
			{"NoSpecial123", false},
			{"Short1!", false},
		}

		for _, tt := range tests {
			err := PasswordValidator(tt.password, nil)
			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		}
	})

	t.Run("UUIDValidator", func(t *testing.T) {
		tests := []struct {
			uuid    string
			isValid bool
		}{
			{"550e8400-e29b-41d4-a716-446655440000", true},
			{"6ba7b810-9dad-11d1-80b4-00c04fd430c8", true},
			{"invalid-uuid", false},
			{"550e8400-e29b-41d4", false},
		}

		for _, tt := range tests {
			err := UUIDValidator(tt.uuid, nil)
			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "invalid UUID format")
			}
		}
	})
}

func TestGetRouteFromContext(t *testing.T) {
	ctx := context.Background()

	// Test with no route in context
	_, ok := GetRoute(ctx)
	assert.False(t, ok)

	// Test with route in context
	route := &legacy.Route{
		Method: "GET",
		Path:   "/test",
	}
	ctx = context.WithValue(ctx, RouteKey, route)

	retrievedRoute, ok := GetRoute(ctx)
	assert.True(t, ok)
	assert.Equal(t, route, retrievedRoute)
}

func BenchmarkValidationMiddleware(b *testing.B) {
	spec := createTestSpec()
	config := ValidationConfig{
		SpecLoader:               spec,
		EnableRequestValidation:  true,
		EnableResponseValidation: false,
		StrictMode:               false,
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw, err := NewValidationMiddleware(config, logger)
	require.NoError(b, err)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}

// Helper functions

func createTestSpec() *openapi3.T {
	return &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   "Test API",
			Version: "1.0.0",
		},
		Paths: openapi3.Paths{
			"/test": &openapi3.PathItem{
				Get: &openapi3.Operation{
					OperationID: "testOperation",
					Responses: openapi3.Responses{
						"200": &openapi3.ResponseRef{
							Value: &openapi3.Response{
								Description: "Success",
							},
						},
					},
				},
			},
		},
	}
}

func createTestSpecWithRequestBody() *openapi3.T {
	emailSchema := openapi3.NewStringSchema()
	emailSchema.Format = "email"

	passwordSchema := openapi3.NewStringSchema()
	passwordSchema.MinLength = 8

	tenantIDSchema := openapi3.NewStringSchema()
	tenantIDSchema.Format = "uuid"

	requestBody := openapi3.NewRequestBody()
	requestBody.Content = openapi3.NewContentWithJSONSchema(&openapi3.Schema{
		Type: "object",
		Properties: map[string]*openapi3.SchemaRef{
			"email": {
				Value: emailSchema,
			},
			"password": {
				Value: passwordSchema,
			},
			"tenant_id": {
				Value: tenantIDSchema,
			},
		},
		Required: []string{"email", "password", "tenant_id"},
	})

	return &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   "Test API",
			Version: "1.0.0",
		},
		Paths: openapi3.Paths{
			"/users": &openapi3.PathItem{
				Post: &openapi3.Operation{
					OperationID: "createUser",
					RequestBody: &openapi3.RequestBodyRef{
						Value: requestBody,
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
}
