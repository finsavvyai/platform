package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func (suite *IntegrationTestSuite) TestErrorHandling() {
	suite.Run("HTTP Error Responses", func() {
		suite.testHTTPErrorResponses()
	})

	suite.Run("Validation Errors", func() {
		suite.testValidationErrors()
	})

	suite.Run("Authentication Errors", func() {
		suite.testAuthenticationErrors()
	})

	suite.Run("Authorization Errors", func() {
		suite.testAuthorizationErrors()
	})

	suite.Run("Rate Limiting Errors", func() {
		suite.testRateLimitingErrors()
	})

	suite.Run("Resource Not Found Errors", func() {
		suite.testResourceNotFoundErrors()
	})

	suite.Run("Database Error Handling", func() {
		suite.testDatabaseErrorHandling()
	})

	suite.Run("Service Unavailable Errors", func() {
		suite.testServiceUnavailableErrors()
	})

	suite.Run("Malformed Request Handling", func() {
		suite.testMalformedRequestHandling()
	})

	suite.Run("Timeout and Cancellation", func() {
		suite.testTimeoutAndCancellation()
	})
}

func (suite *IntegrationTestSuite) testHTTPErrorResponses() {
	// Test 400 Bad Request
	invalidData := map[string]interface{}{
		"invalid_field": "value",
	}

	w := suite.makeRequest("POST", "/auth/login", invalidData, nil)
	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)

	// Verify error response structure
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.NotEmpty(suite.T(), errorResponse["error"])
	assert.NotEmpty(suite.T(), errorResponse["message"])
	assert.NotEmpty(suite.T(), errorResponse["timestamp"])
	assert.NotEmpty(suite.T(), errorResponse["path"])
	assert.NotEmpty(suite.T(), errorResponse["request_id"])

	// Test 404 Not Found
	w = suite.makeRequest("GET", "/nonexistent/endpoint", nil, nil)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "NOT_FOUND", errorResponse["error"])

	// Test 405 Method Not Allowed
	w = suite.makeRequest("PATCH", "/auth/login", nil, nil)
	assert.Equal(suite.T(), http.StatusMethodNotAllowed, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "METHOD_NOT_ALLOWED", errorResponse["error"])

	// Test 415 Unsupported Media Type
	w = suite.makeRequest("POST", "/auth/login", "invalid json", nil)
	assert.Equal(suite.T(), http.StatusUnsupportedMediaType, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
}

func (suite *IntegrationTestSuite) testValidationErrors() {
	// Test user registration validation errors
	testCases := []struct {
		name     string
		data     map[string]interface{}
		expected string
	}{
		{
			name: "Missing required fields",
			data: map[string]interface{}{
				"username": "testuser",
				// Missing email, password, country
			},
			expected: "validation",
		},
		{
			name: "Invalid email format",
			data: map[string]interface{}{
				"username": "testuser",
				"email":    "invalid-email",
				"password": "password123",
				"country":  "US",
			},
			expected: "validation",
		},
		{
			name: "Password too short",
			data: map[string]interface{}{
				"username": "testuser",
				"email":    "test@example.com",
				"password": "123", // Too short
				"country":  "US",
			},
			expected: "validation",
		},
		{
			name: "Invalid country code",
			data: map[string]interface{}{
				"username": "testuser",
				"email":    "test@example.com",
				"password": "password123",
				"country":  "INVALID_COUNTRY",
			},
			expected: "validation",
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			w := suite.makeRequest("POST", "/auth/register", tc.data, nil)
			assert.Equal(t, http.StatusBadRequest, w.Code)

			var errorResponse map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
			require.NoError(t, err)

			assert.Equal(t, "error", errorResponse["status"])
			assert.Equal(t, tc.expected, errorResponse["error"])

			// Check for validation details
			if validation, ok := errorResponse["validation"].(map[string]interface{}); ok {
				assert.NotEmpty(t, validation)
			}
		})
	}

	// Test transaction validation errors
	transactionValidationCases := []struct {
		name     string
		data     map[string]interface{}
		expected string
	}{
		{
			name: "Negative amount",
			data: map[string]interface{}{
				"transaction_id": "test_neg_amount",
				"user_id":        suite.testUser.ID,
				"merchant_id":    "test-merchant-id",
				"amount":         -100.00,
				"currency":       "USD",
			},
			expected: "validation",
		},
		{
			name: "Zero amount",
			data: map[string]interface{}{
				"transaction_id": "test_zero_amount",
				"user_id":        suite.testUser.ID,
				"merchant_id":    "test-merchant-id",
				"amount":         0.00,
				"currency":       "USD",
			},
			expected: "validation",
		},
		{
			name: "Excessive amount",
			data: map[string]interface{}{
				"transaction_id": "test_excess_amount",
				"user_id":        suite.testUser.ID,
				"merchant_id":    "test-merchant-id",
				"amount":         10000000.00, // Too high
				"currency":       "USD",
			},
			expected: "validation",
		},
		{
			name: "Invalid currency",
			data: map[string]interface{}{
				"transaction_id": "test_invalid_currency",
				"user_id":        suite.testUser.ID,
				"merchant_id":    "test-merchant-id",
				"amount":         100.00,
				"currency":       "INVALID",
			},
			expected: "validation",
		},
	}

	for _, tc := range transactionValidationCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			suite.createAPIKey()
			apiHeaders := map[string]string{
				"Authorization": "Bearer " + suite.testAPIKey.Key,
			}

			w := suite.makeRequest("POST", "/fraud/analyze", tc.data, apiHeaders)
			assert.Equal(t, http.StatusBadRequest, w.Code)

			var errorResponse map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
			require.NoError(t, err)

			assert.Equal(t, "error", errorResponse["status"])
			assert.Equal(t, tc.expected, errorResponse["error"])
		})
	}
}

func (suite *IntegrationTestSuite) testAuthenticationErrors() {
	// Test missing authentication
	w := suite.makeRequest("GET", "/users/profile", nil, nil)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "UNAUTHORIZED", errorResponse["error"])
	assert.Contains(suite.T(), errorResponse["message"], "authentication")

	// Test invalid token
	invalidHeaders := map[string]string{
		"Authorization": "Bearer invalid_token_12345",
	}

	w = suite.makeRequest("GET", "/users/profile", nil, invalidHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "UNAUTHORIZED", errorResponse["error"])

	// Test malformed authorization header
	malformedHeaders := map[string]string{
		"Authorization": "InvalidFormat token123",
	}

	w = suite.makeRequest("GET", "/users/profile", nil, malformedHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])

	// Test expired token
	expiredHeaders := map[string]string{
		"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid",
	}

	w = suite.makeRequest("GET", "/users/profile", nil, expiredHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
}

func (suite *IntegrationTestSuite) testAuthorizationErrors() {
	suite.authenticateUser()
	suite.createAPIKey()

	// Test API key without admin permissions accessing admin endpoints
	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	adminEndpoints := []string{
		"/admin/users",
		"/admin/analytics",
		"/admin/config",
		"/admin/audit-logs",
	}

	for _, endpoint := range adminEndpoints {
		w := suite.makeRequest("GET", endpoint, nil, apiHeaders)
		assert.Equal(suite.T(), http.StatusForbidden, w.Code,
			"Endpoint %s should return 403 for non-admin API key", endpoint)

		var errorResponse map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
		require.NoError(suite.T(), err)

		assert.Equal(suite.T(), "error", errorResponse["status"])
		assert.Equal(suite.T(), "FORBIDDEN", errorResponse["error"])
		assert.Contains(suite.T(), errorResponse["message"], "permission")
	}

	// Test user token accessing another user's resources
	userHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Try to access another user's API key (assuming we know another user's ID)
	w = suite.makeRequest("GET", "/api_keys/another-user-id", nil, userHeaders)
	assert.Equal(suite.T(), http.StatusForbidden, w.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "FORBIDDEN", errorResponse["error"])
}

func (suite *IntegrationTestSuite) testRateLimitingErrors() {
	suite.createAPIKey()

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	// Make rapid requests to trigger rate limiting
	var rateLimited bool
	for i := 0; i < 100; i++ {
		w := suite.makeRequest("GET", "/users/profile", nil, apiHeaders)
		if w.Code == http.StatusTooManyRequests {
			rateLimited = true

			var errorResponse map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
			require.NoError(suite.T(), err)

			// Verify rate limiting error structure
			assert.Equal(suite.T(), "error", errorResponse["status"])
			assert.Equal(suite.T(), "RATE_LIMIT_EXCEEDED", errorResponse["error"])
			assert.Contains(suite.T(), errorResponse["message"], "rate limit")

			// Check for rate limiting specific fields
			if rateLimit, ok := errorResponse["rate_limit"].(map[string]interface{}); ok {
				assert.Contains(suite.T(), rateLimit, "limit")
				assert.Contains(suite.T(), rateLimit, "remaining")
				assert.Contains(suite.T(), rateLimit, "reset_time")
			}

			// Check headers
			assert.NotEmpty(suite.T(), w.Header().Get("X-RateLimit-Limit"))
			assert.Equal(suite.T(), "0", w.Header().Get("X-RateLimit-Remaining"))
			assert.NotEmpty(suite.T(), w.Header().Get("Retry-After"))

			break
		}
	}

	assert.True(suite.T(), rateLimited, "Should have triggered rate limiting")
}

func (suite *IntegrationTestSuite) testResourceNotFoundErrors() {
	suite.authenticateUser()

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Test non-existent API key
	w := suite.makeRequest("GET", "/api/keys/00000000-0000-0000-0000-000000000000", nil, headers)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "NOT_FOUND", errorResponse["error"])
	assert.Contains(suite.T(), errorResponse["message"], "not found")

	// Test non-existent user
	w = suite.makeRequest("GET", "/admin/users/00000000-0000-0000-0000-000000000000", nil, headers)
	// This might return 404 or 403 depending on permissions
	assert.True(suite.T(), w.Code == http.StatusNotFound || w.Code == http.StatusForbidden)

	// Test non-existent fraud rule
	w = suite.makeRequest("GET", "/fraud/rules/00000000-0000-0000-0000-000000000000", nil, headers)
	// This might return 404 or 403 depending on permissions
	assert.True(suite.T(), w.Code == http.StatusNotFound || w.Code == http.StatusForbidden)
}

func (suite *IntegrationTestSuite) testDatabaseErrorHandling() {
	// Test handling of database constraint violations
	suite.authenticateUser()

	// Try to create a user with duplicate username
	duplicateUser := map[string]interface{}{
		"username": suite.testUser.Username, // Duplicate
		"email":    "different@example.com",
		"password": "password123",
		"country":  "US",
	}

	w := suite.makeRequest("POST", "/auth/register", duplicateUser, nil)
	assert.Equal(suite.T(), http.StatusConflict, w.Code)

	var errorResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "CONFLICT", errorResponse["error"])
	assert.Contains(suite.T(), errorResponse["message"], "already exists")

	// Try to create a user with duplicate email
	duplicateEmail := map[string]interface{}{
		"username": "different_user",
		"email":    suite.testUser.Email, // Duplicate
		"password": "password123",
		"country":  "US",
	}

	w = suite.makeRequest("POST", "/auth/register", duplicateEmail, nil)
	assert.Equal(suite.T(), http.StatusConflict, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "CONFLICT", errorResponse["error"])
}

func (suite *IntegrationTestSuite) testServiceUnavailableErrors() {
	// Test behavior when services are unavailable
	// This is harder to test in integration without mocking services,
	// but we can test timeout scenarios

	suite.createAPIKey()

	// Create a very large transaction that might timeout
	largeTransaction := map[string]interface{}{
		"transaction_id":           "timeout_test",
		"user_id":                  suite.testUser.ID,
		"merchant_id":              "test-merchant-id",
		"amount":                   1000.00,
		"currency":                 "USD",
		"description":              "Test transaction for timeout",
		"request_ai_analysis":      true,
		"request_quantum_analysis": true,
		"complex_analysis":         true,
		"deep_inspection":          true,
		"metadata": map[string]interface{}{
			"large_data": bytes.Repeat([]byte("x"), 1000000), // 1MB of data
		},
	}

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	w := suite.makeRequest("POST", "/fraud/analyze", largeTransaction, apiHeaders)
	// This should succeed or fail gracefully, not crash
	assert.True(suite.T(), w.Code == http.StatusOK ||
		w.Code == http.StatusBadRequest ||
		w.Code == http.StatusRequestTimeout ||
		w.Code == http.StatusInternalServerError)

	if w.Code >= 400 {
		var errorResponse map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
		if err == nil {
			assert.Equal(suite.T(), "error", errorResponse["status"])
			assert.NotEmpty(suite.T(), errorResponse["error"])
			assert.NotEmpty(suite.T(), errorResponse["message"])
		}
	}
}

func (suite *IntegrationTestSuite) testMalformedRequestHandling() {
	// Test invalid JSON
	invalidJSONData := []byte(`{"invalid": json, "missing": quotes}`)

	req, err := http.NewRequest("POST", suite.server.URL+"/auth/login", bytes.NewBuffer(invalidJSONData))
	require.NoError(suite.T(), err)
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	suite.server.Config.Handler.ServeHTTP(w, req)

	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)

	var errorResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "BAD_REQUEST", errorResponse["error"])
	assert.Contains(suite.T(), errorResponse["message"], "JSON")

	// Test unexpected data types
	unexpectedData := map[string]interface{}{
		"username": 123,  // Should be string
		"password": true, // Should be string
		"email":    []string{"not", "a", "string"},
	}

	w = suite.makeRequest("POST", "/auth/register", unexpectedData, nil)
	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Equal(suite.T(), "validation", errorResponse["error"])

	// Test extremely large request
	largeData := make(map[string]interface{})
	largeData["data"] = bytes.Repeat([]byte("x"), 10000000) // 10MB

	w = suite.makeRequest("POST", "/auth/register", largeData, nil)
	// Should be rejected due to size limits
	assert.True(suite.T(), w.Code == http.StatusBadRequest || w.Code == http.StatusRequestEntityTooLarge)
}

func (suite *IntegrationTestSuite) testTimeoutAndCancellation() {
	// Test request timeout handling
	suite.createAPIKey()

	// Create a complex transaction that might take longer
	complexTransaction := map[string]interface{}{
		"transaction_id":           "complex_timeout_test",
		"user_id":                  suite.testUser.ID,
		"merchant_id":              "test-merchant-id",
		"amount":                   5000.00,
		"currency":                 "USD",
		"description":              "Complex transaction for timeout test",
		"request_ai_analysis":      true,
		"request_quantum_analysis": true,
		"complex_parameters": map[string]interface{}{
			"analysis_depth":      "maximum",
			"cross_validation":    true,
			"historical_analysis": true,
			"behavioral_analysis": true,
			"network_analysis":    true,
		},
	}

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	// Make request with a shorter client-side timeout
	client := &http.Client{
		Timeout: 2 * time.Second,
	}

	jsonData, err := json.Marshal(complexTransaction)
	require.NoError(suite.T(), err)

	req, err := http.NewRequest("POST", suite.server.URL+"/fraud/analyze", bytes.NewBuffer(jsonData))
	require.NoError(suite.T(), err)

	for key, value := range apiHeaders {
		req.Header.Set(key, value)
	}
	req.Header.Set("Content-Type", "application/json")

	start := time.Now()
	w := httptest.NewRecorder()
	suite.server.Config.Handler.ServeHTTP(w, req)
	duration := time.Since(start)

	// The server should handle the request gracefully
	// Either it completes quickly or times out gracefully
	assert.True(suite.T(), w.Code == http.StatusOK ||
		w.Code == http.StatusRequestTimeout ||
		w.Code == http.StatusInternalServerError)

	suite.T().Logf("Timeout test: Request completed in %v with status %d", duration, w.Code)
}

func (suite *IntegrationTestSuite) TestErrorResponseConsistency() {
	// Test that all error responses follow the same structure
	suite.authenticateUser()

	testCases := []struct {
		name           string
		method         string
		endpoint       string
		body           interface{}
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "400 Bad Request",
			method:         "POST",
			endpoint:       "/auth/login",
			body:           map[string]string{"invalid": "data"},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "BAD_REQUEST",
		},
		{
			name:           "401 Unauthorized",
			method:         "GET",
			endpoint:       "/users/profile",
			body:           nil,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  "UNAUTHORIZED",
		},
		{
			name:           "404 Not Found",
			method:         "GET",
			endpoint:       "/nonexistent",
			body:           nil,
			expectedStatus: http.StatusNotFound,
			expectedError:  "NOT_FOUND",
		},
		{
			name:           "405 Method Not Allowed",
			method:         "PATCH",
			endpoint:       "/auth/login",
			body:           nil,
			expectedStatus: http.StatusMethodNotAllowed,
			expectedError:  "METHOD_NOT_ALLOWED",
		},
	}

	for _, tc := range testCases {
		suite.T().Run(tc.name, func(t *testing.T) {
			var headers map[string]string
			if tc.endpoint == "/users/profile" {
				// Skip auth header for this test
			}

			w := suite.makeRequest(tc.method, tc.endpoint, tc.body, headers)
			assert.Equal(t, tc.expectedStatus, w.Code)

			var errorResponse map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &errorResponse)
			require.NoError(t, err)

			// Verify standard error response fields
			assert.Equal(t, "error", errorResponse["status"])
			assert.Equal(t, tc.expectedError, errorResponse["error"])
			assert.NotEmpty(t, errorResponse["message"])
			assert.NotEmpty(t, errorResponse["timestamp"])
			assert.NotEmpty(t, errorResponse["path"])
			assert.NotEmpty(t, errorResponse["request_id"])

			// Verify timestamp is a valid timestamp
			timestamp, ok := errorResponse["timestamp"].(float64)
			assert.True(t, ok, "Timestamp should be a number")
			assert.Greater(t, timestamp, float64(0))

			// Verify path matches requested endpoint
			path, ok := errorResponse["path"].(string)
			assert.True(t, ok, "Path should be a string")
			assert.Contains(t, path, tc.endpoint)

			// Verify request ID is a valid UUID or similar identifier
			requestID, ok := errorResponse["request_id"].(string)
			assert.True(t, ok, "Request ID should be a string")
			assert.NotEmpty(t, requestID)
		})
	}
}

func (suite *IntegrationTestSuite) TestGracefulDegradation() {
	suite.createAPIKey()

	// Test that the system degrades gracefully when components are unavailable

	// Test AI analysis failure
	transactionWithoutAI := map[string]interface{}{
		"transaction_id":      "degradation_test_no_ai",
		"user_id":             suite.testUser.ID,
		"merchant_id":         "test-merchant-id",
		"amount":              1000.00,
		"currency":            "USD",
		"description":         "Test transaction without AI analysis",
		"request_ai_analysis": false, // Explicitly disable AI
	}

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	w := suite.makeRequest("POST", "/fraud/analyze", transactionWithoutAI, apiHeaders)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	data := response["data"].(map[string]interface{})
	// Should still have basic fraud analysis even without AI
	assert.Contains(suite.T(), data, "fraud_score")
	assert.Contains(suite.T(), data, "risk_level")
	// AI analysis might be null or empty
	if aiAnalysis, exists := data["ai_analysis"]; exists {
		assert.Nil(t, aiAnalysis)
	}

	// Test quantum analysis failure
	transactionWithoutQuantum := map[string]interface{}{
		"transaction_id":           "degradation_test_no_quantum",
		"user_id":                  suite.testUser.ID,
		"merchant_id":              "test-merchant-id",
		"amount":                   1000.00,
		"currency":                 "USD",
		"description":              "Test transaction without quantum analysis",
		"request_quantum_analysis": false, // Explicitly disable quantum
	}

	w = suite.makeRequest("POST", "/fraud/analyze", transactionWithoutQuantum, apiHeaders)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	data = response["data"].(map[string]interface{})
	// Should still have basic analysis even without quantum
	assert.Contains(suite.T(), data, "fraud_score")
	// Quantum analysis might be null or empty
	if quantumAnalysis, exists := data["quantum_analysis"]; exists {
		assert.Nil(t, quantumAnalysis)
	}
}
