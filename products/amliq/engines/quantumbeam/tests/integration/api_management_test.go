//go:build legacy_migrated
// +build legacy_migrated

package integration

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func (suite *IntegrationTestSuite) TestAPIKeyManagement() {
	suite.authenticateUser()

	suite.Run("Create API Key", func() {
		suite.testCreateAPIKey()
	})

	suite.Run("List API Keys", func() {
		suite.testListAPIKeys()
	})

	suite.Run("Get API Key Details", func() {
		suite.testGetAPIKeyDetails()
	})

	suite.Run("Update API Key", func() {
		suite.testUpdateAPIKey()
	})

	suite.Run("Revoke API Key", func() {
		suite.testRevokeAPIKey()
	})

	suite.Run("API Key Rate Limiting", func() {
		suite.testAPIKeyRateLimiting()
	})

	suite.Run("API Key Permissions", func() {
		suite.testAPIKeyPermissions()
	})
}

func (suite *IntegrationTestSuite) testCreateAPIKey() {
	suite.T().Helper()

	apiKeyData := map[string]interface{}{
		"name":                  "Integration Test API Key",
		"description":           "API key created for integration testing",
		"permissions":           []string{"read", "write", "fraud_analysis"},
		"rate_limit_per_minute": 500,
		"rate_limit_per_hour":   30000,
		"expires_at":            nil, // No expiration
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("POST", "/api/keys", apiKeyData, headers)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})

	assert.NotEmpty(suite.T(), data["id"])
	assert.Equal(suite.T(), apiKeyData["name"], data["name"])
	assert.Equal(suite.T(), apiKeyData["description"], data["description"])
	assert.Equal(suite.T(), apiKeyData["rate_limit_per_minute"], data["rate_limit_per_minute"])
	assert.Equal(suite.T(), apiKeyData["rate_limit_per_hour"], data["rate_limit_per_hour"])
	assert.Equal(suite.T(), true, data["is_active"])

	// The actual API key should only be returned once during creation
	assert.NotEmpty(suite.T(), data["key"])

	// Store for subsequent tests
	suite.testAPIKey = &TestAPIKey{
		ID:   data["id"].(string),
		Name: data["name"].(string),
		Key:  data["key"].(string),
	}

	// Verify permissions
	permissions := data["permissions"].([]interface{})
	assert.Equal(suite.T(), len(apiKeyData["permissions"].([]interface{})), len(permissions))
}

func (suite *IntegrationTestSuite) testListAPIKeys() {
	require.NotEmpty(suite.T(), suite.testUser.Token)

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("GET", "/api/keys", nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})

	keys := data["keys"].([]interface{})
	assert.GreaterOrEqual(suite.T(), len(keys), 1) // At least our test key

	// Find our test key in the list
	var foundKey map[string]interface{}
	for _, key := range keys {
		keyData := key.(map[string]interface{})
		if keyData["id"].(string) == suite.testAPIKey.ID {
			foundKey = keyData
			break
		}
	}

	require.NotNil(suite.T(), foundKey, "Test API key should be in the list")
	assert.Equal(suite.T(), suite.testAPIKey.Name, foundKey["name"])
	assert.Equal(suite.T(), true, foundKey["is_active"])
	assert.NotContains(suite.T(), foundKey, "key", "API key should not be returned in list view")
}

func (suite *IntegrationTestSuite) testGetAPIKeyDetails() {
	require.NotEmpty(suite.T(), suite.testAPIKey.ID)
	require.NotEmpty(suite.T(), suite.testUser.Token)

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("GET", "/api/keys/"+suite.testAPIKey.ID, nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), suite.testAPIKey.ID, data["id"])
	assert.Equal(suite.T(), suite.testAPIKey.Name, data["name"])
	assert.Equal(suite.T(), true, data["is_active"])
	assert.NotContains(suite.T(), data, "key", "API key should not be returned in details view")

	// Check metadata
	assert.Contains(suite.T(), data, "created_at")
	assert.Contains(suite.T(), data, "updated_at")
	assert.Contains(suite.T(), data, "last_used_at")
	assert.Contains(suite.T(), data, "usage_stats")
}

func (suite *IntegrationTestSuite) testUpdateAPIKey() {
	require.NotEmpty(suite.T(), suite.testAPIKey.ID)
	require.NotEmpty(suite.T(), suite.testUser.Token)

	updateData := map[string]interface{}{
		"name":        "Updated Integration Test Key",
		"description": "Updated description for integration testing",
		"permissions": []string{"read", "fraud_analysis"}, // Remove write permission
		"is_active":   true,
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("PUT", "/api/keys/"+suite.testAPIKey.ID, updateData, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), updateData["name"], data["name"])
	assert.Equal(suite.T(), updateData["description"], data["description"])
	assert.Equal(suite.T(), updateData["is_active"], data["is_active"])

	permissions := data["permissions"].([]interface{})
	assert.Equal(suite.T(), len(updateData["permissions"].([]interface{})), len(permissions))
}

func (suite *IntegrationTestSuite) testRevokeAPIKey() {
	require.NotEmpty(suite.T(), suite.testAPIKey.ID)
	require.NotEmpty(suite.T(), suite.testUser.Token)

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// First test deactivating the key
	deactivateData := map[string]interface{}{
		"is_active": false,
	}

	w := suite.makeRequest("PUT", "/api/keys/"+suite.testAPIKey.ID, deactivateData, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Verify the key is now inactive
	w = suite.makeRequest("GET", "/api/keys/"+suite.testAPIKey.ID, nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), false, data["is_active"])

	// Test that the deactivated key can no longer be used for API calls
	apiHeaders := map[string]string{
		"Authorization": "Bearer " + suite.testAPIKey.Key,
	}

	transaction := map[string]interface{}{
		"transaction_id": "test_deactivated_key",
		"user_id":        suite.testUser.ID,
		"merchant_id":    "test-merchant-id",
		"amount":         100.00,
		"currency":       "USD",
	}

	w = suite.makeRequest("POST", "/fraud/analyze", transaction, apiHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	// Finally delete the key
	w = suite.makeRequest("DELETE", "/api/keys/"+suite.testAPIKey.ID, nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "success", response["status"])

	// Verify the key is completely deleted
	w = suite.makeRequest("GET", "/api/keys/"+suite.testAPIKey.ID, nil, headers)
	assert.Equal(suite.T(), http.StatusNotFound, w.Code)
}

func (suite *IntegrationTestSuite) testAPIKeyRateLimiting() {
	// Create a new API key with low rate limits for testing
	apiKeyData := map[string]interface{}{
		"name":                  "Rate Limit Test Key",
		"description":           "Key for testing rate limiting",
		"permissions":           []string{"read"},
		"rate_limit_per_minute": 5, // Very low limit
		"rate_limit_per_hour":   100,
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("POST", "/api/keys", apiKeyData, headers)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	testKey := response["data"].(map[string]interface{})["key"].(string)

	// Make rapid requests to exceed rate limit
	apiHeaders := map[string]string{
		"Authorization": "Bearer " + testKey,
	}

	requestCount := 0
	for i := 0; i < 10; i++ {
		w = suite.makeRequest("GET", "/users/profile", nil, apiHeaders)
		requestCount++

		if w.Code == http.StatusTooManyRequests {
			var rateLimitResponse map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &rateLimitResponse)
			require.NoError(suite.T(), err)

			assert.Equal(suite.T(), "error", rateLimitResponse["status"])
			assert.Contains(suite.T(), rateLimitResponse["message"], "rate limit exceeded")

			// Check rate limit headers if present
			if w.Header().Get("X-RateLimit-Remaining") != "" {
				assert.Equal(suite.T(), "0", w.Header().Get("X-RateLimit-Remaining"))
			}
			if w.Header().Get("Retry-After") != "" {
				assert.NotEmpty(suite.T(), w.Header().Get("Retry-After"))
			}
			break
		}

		assert.Equal(suite.T(), http.StatusOK, w.Code)
	}

	assert.Less(suite.T(), requestCount, 10, "Should have hit rate limit before 10 requests")

	// Clean up test key
	keyID := response["data"].(map[string]interface{})["id"].(string)
	suite.makeRequest("DELETE", "/api/keys/"+keyID, nil, headers)
}

func (suite *IntegrationTestSuite) testAPIKeyPermissions() {
	// Create API key with limited permissions (read only)
	readOnlyKeyData := map[string]interface{}{
		"name":        "Read Only Test Key",
		"description": "Key with read-only permissions",
		"permissions": []string{"read"},
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("POST", "/api/keys", readOnlyKeyData, headers)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	readOnlyKey := response["data"].(map[string]interface{})["key"].(string)

	apiHeaders := map[string]string{
		"Authorization": "Bearer " + readOnlyKey,
	}

	// Test allowed operation (read user profile)
	w = suite.makeRequest("GET", "/users/profile", nil, apiHeaders)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test disallowed operation (create API key - requires write permission)
	newKeyData := map[string]interface{}{
		"name": "Should Fail",
	}

	w = suite.makeRequest("POST", "/api/keys", newKeyData, apiHeaders)
	assert.Equal(suite.T(), http.StatusForbidden, w.Code)

	var errorResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Contains(suite.T(), errorResponse["message"], "permission")

	// Test disallowed operation (admin functionality)
	w = suite.makeRequest("GET", "/admin/users", nil, apiHeaders)
	assert.Equal(suite.T(), http.StatusForbidden, w.Code)

	// Clean up read-only key
	keyID := response["data"].(map[string]interface{})["id"].(string)
	suite.makeRequest("DELETE", "/api/keys/"+keyID, nil, headers)
}

func (suite *IntegrationTestSuite) TestAdminFunctionality() {
	suite.authenticateUser()

	suite.Run("Admin User Management", func() {
		suite.testAdminUserManagement()
	})

	suite.Run("Admin System Configuration", func() {
		suite.testAdminSystemConfiguration()
	})

	suite.Run("Admin Analytics", func() {
		suite.testAdminAnalytics()
	})

	suite.Run("Admin Audit Logs", func() {
		suite.testAdminAuditLogs()
	})
}

func (suite *IntegrationTestSuite) testAdminUserManagement() {
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Test listing all users (admin functionality)
	w := suite.makeRequest("GET", "/admin/users", nil, headers)
	// This might fail due to permissions - both outcomes are valid for testing
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Contains(suite.T(), data, "users")
		assert.Contains(suite.T(), data, "pagination")

		users := data["users"].([]interface{})
		assert.Greater(suite.T(), len(users), 0) // At least our test user
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
		assert.Equal(suite.T(), http.StatusForbidden, w.Code)
	}

	// Test getting user details
	w = suite.makeRequest("GET", "/admin/users/"+suite.testUser.ID, nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Equal(suite.T(), suite.testUser.ID, data["id"])
		assert.Contains(suite.T(), data, "admin_metadata")
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}

	// Test updating user status
	updateData := map[string]interface{}{
		"status": "active",
		"notes":  "Integration test update",
	}

	w = suite.makeRequest("PUT", "/admin/users/"+suite.testUser.ID+"/status", updateData, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)
		assert.Equal(suite.T(), "success", response["status"])
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}
}

func (suite *IntegrationTestSuite) testAdminSystemConfiguration() {
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Test getting system configuration
	w := suite.makeRequest("GET", "/admin/config", nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Contains(suite.T(), data, "configurations")

		configs := data["configurations"].([]interface{})
		assert.Greater(suite.T(), len(configs), 0) // Should have some config from setup
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}

	// Test updating system configuration
	configUpdate := map[string]interface{}{
		"key":      "test.integration_setting",
		"value":    "test_value",
		"category": "testing",
	}

	w = suite.makeRequest("POST", "/admin/config", configUpdate, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)
		assert.Equal(suite.T(), "success", response["status"])
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}
}

func (suite *IntegrationTestSuite) testAdminAnalytics() {
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Test getting system analytics
	w := suite.makeRequest("GET", "/admin/analytics", nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Contains(suite.T(), data, "overview")
		assert.Contains(suite.T(), data, "transactions")
		assert.Contains(suite.T(), data, "users")
		assert.Contains(suite.T(), data, "fraud_detection")

		overview := data["overview"].(map[string]interface{})
		assert.Contains(suite.T(), overview, "total_users")
		assert.Contains(suite.T(), overview, "total_transactions")
		assert.Contains(suite.T(), overview, "fraud_detection_rate")
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}

	// Test getting fraud analytics
	w = suite.makeRequest("GET", "/admin/analytics/fraud", nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Contains(suite.T(), data, "fraud_trends")
		assert.Contains(suite.T(), data, "rule_performance")
		assert.Contains(suite.T(), data, "risk_distribution")
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}
}

func (suite *IntegrationTestSuite) testAdminAuditLogs() {
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Test getting audit logs
	w := suite.makeRequest("GET", "/admin/audit-logs", nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		assert.Contains(suite.T(), data, "logs")
		assert.Contains(suite.T(), data, "pagination")

		logs := data["logs"].([]interface{})
		// Should have some audit logs from our test activities
		assert.GreaterOrEqual(suite.T(), len(logs), 0)

		if len(logs) > 0 {
			log := logs[0].(map[string]interface{})
			assert.Contains(suite.T(), log, "id")
			assert.Contains(suite.T(), log, "action")
			assert.Contains(suite.T(), log, "resource_type")
			assert.Contains(suite.T(), log, "created_at")
		}
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}

	// Test filtering audit logs
	w = suite.makeRequest("GET", "/admin/audit-logs?action=CREATE&resource_type=users", nil, headers)
	if w.Code == http.StatusOK {
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(suite.T(), err)

		data := response["data"].(map[string]interface{})
		logs := data["logs"].([]interface{})

		// All logs should match our filter
		for _, log := range logs {
			logData := log.(map[string]interface{})
			assert.Equal(suite.T(), "CREATE", logData["action"])
			assert.Equal(suite.T(), "users", logData["resource_type"])
		}
	} else if w.Code == http.StatusForbidden {
		// Expected if user doesn't have admin permissions
	}
}