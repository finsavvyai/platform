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

func (suite *IntegrationTestSuite) TestAuthenticationFlow() {
	suite.Run("User Registration", func() {
		suite.testUserRegistration()
	})

	suite.Run("User Login", func() {
		suite.testUserLogin()
	})

	suite.Run("Token Validation", func() {
		suite.testTokenValidation()
	})

	suite.Run("Invalid Authentication", func() {
		suite.testInvalidAuthentication()
	})

	suite.Run("Password Reset Flow", func() {
		suite.testPasswordResetFlow()
	})
}

func (suite *IntegrationTestSuite) testUserRegistration() {
	// Test successful user registration
	newUser := map[string]interface{}{
		"username":  "newuser",
		"email":     "newuser@example.com",
		"password":  "newpassword123",
		"full_name": "New User",
		"country":   "US",
	}

	w := suite.makeRequest("POST", "/auth/register", newUser, nil)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})
	assert.NotEmpty(suite.T(), data["user_id"])
	assert.Equal(suite.T(), newUser["username"], data["username"])
	assert.Equal(suite.T(), newUser["email"], data["email"])
	assert.NotEmpty(suite.T(), data["token"])

	// Test duplicate registration
	w = suite.makeRequest("POST", "/auth/register", newUser, nil)
	assert.Equal(suite.T(), http.StatusConflict, w.Code)

	var errorResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Contains(suite.T(), errorResponse["message"], "already exists")
}

func (suite *IntegrationTestSuite) testUserLogin() {
	// Test successful login
	loginData := map[string]string{
		"username": suite.testUser.Username,
		"password": suite.testUser.Password,
	}

	w := suite.makeRequest("POST", "/auth/login", loginData, nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})
	assert.NotEmpty(suite.T(), data["token"])
	assert.NotEmpty(suite.T(), data["user"])
	assert.Equal(suite.T(), suite.testUser.Username, data["user"].(map[string]interface{})["username"])

	// Store token for subsequent tests
	suite.testUser.Token = data["token"].(string)

	// Test login with invalid credentials
	invalidLogin := map[string]string{
		"username": suite.testUser.Username,
		"password": "wrongpassword",
	}

	w = suite.makeRequest("POST", "/auth/login", invalidLogin, nil)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	var errorResponse map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &errorResponse)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", errorResponse["status"])
	assert.Contains(suite.T(), errorResponse["message"], "Invalid credentials")
}

func (suite *IntegrationTestSuite) testTokenValidation() {
	require.NotEmpty(suite.T(), suite.testUser.Token, "User should be authenticated first")

	// Test token validation
	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("GET", "/auth/me", nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), suite.testUser.Username, data["username"])
	assert.Equal(suite.T(), suite.testUser.Email, data["email"])

	// Test with invalid token
	invalidHeaders := map[string]string{
		"Authorization": "Bearer invalid_token",
	}

	w = suite.makeRequest("GET", "/auth/me", nil, invalidHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	// Test without token
	w = suite.makeRequest("GET", "/auth/me", nil, nil)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

func (suite *IntegrationTestSuite) testInvalidAuthentication() {
	// Test malformed authorization header
	headers := map[string]string{
		"Authorization": "InvalidFormat token",
	}

	w := suite.makeRequest("GET", "/auth/me", nil, headers)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)

	// Test expired token (simulate by using a very old token format)
	expiredHeaders := map[string]string{
		"Authorization": "Bearer expired_token_12345",
	}

	w = suite.makeRequest("GET", "/auth/me", nil, expiredHeaders)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

func (suite *IntegrationTestSuite) testPasswordResetFlow() {
	// Test password reset request
	resetData := map[string]string{
		"email": suite.testUser.Email,
	}

	w := suite.makeRequest("POST", "/auth/reset-password/request", resetData, nil)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	assert.Contains(suite.T(), response["message"], "reset email sent")

	// Test password reset with non-existent email
	invalidResetData := map[string]string{
		"email": "nonexistent@example.com",
	}

	w = suite.makeRequest("POST", "/auth/reset-password/request", invalidResetData, nil)
	// Should still return 200 for security (don't reveal if email exists)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	// Test password reset confirmation
	resetConfirmData := map[string]interface{}{
		"token":    "reset_token_123",
		"password": "newpassword456",
	}

	w = suite.makeRequest("POST", "/auth/reset-password/confirm", resetConfirmData, nil)
	// Will fail in test environment due to token validation, but should validate input
	assert.Equal(suite.T(), http.StatusBadRequest, w.Code)
}

func (suite *IntegrationTestSuite) TestUserManagement() {
	suite.authenticateUser()

	suite.Run("Get User Profile", func() {
		suite.testGetUserProfile()
	})

	suite.Run("Update User Profile", func() {
		suite.testUpdateUserProfile()
	})

	suite.Run("Delete User Account", func() {
		suite.testDeleteUserAccount()
	})
}

func (suite *IntegrationTestSuite) testGetUserProfile() {
	require.NotEmpty(suite.T(), suite.testUser.Token)

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("GET", "/users/profile", nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), suite.testUser.Username, data["username"])
	assert.Equal(suite.T(), suite.testUser.Email, data["email"])
	assert.NotEmpty(suite.T(), data["created_at"])
}

func (suite *IntegrationTestSuite) testUpdateUserProfile() {
	require.NotEmpty(suite.T(), suite.testUser.Token)

	updateData := map[string]interface{}{
		"full_name": "Updated Test User",
		"country":   "CA",
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("PUT", "/users/profile", updateData, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)

	assert.Equal(suite.T(), "success", response["status"])
	data := response["data"].(map[string]interface{})
	assert.Equal(suite.T(), updateData["full_name"], data["full_name"])
	assert.Equal(suite.T(), updateData["country"], data["country"])

	// Verify changes persisted
	w = suite.makeRequest("GET", "/users/profile", nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)
	data = response["data"].(map[string]interface{})
	assert.Equal(suite.T(), updateData["full_name"], data["full_name"])
}

func (suite *IntegrationTestSuite) testDeleteUserAccount() {
	// Create a new user specifically for deletion test
	newUser := map[string]interface{}{
		"username":  "deletetest",
		"email":     "delete@example.com",
		"password":  "deletepassword123",
		"full_name": "Delete Test User",
		"country":   "US",
	}

	w := suite.makeRequest("POST", "/auth/register", newUser, nil)
	assert.Equal(suite.T(), http.StatusCreated, w.Code)

	var registerResponse map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &registerResponse)
	require.NoError(suite.T(), err)
	token := registerResponse["data"].(map[string]interface{})["token"].(string)

	// Delete the user
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	w = suite.makeRequest("DELETE", "/users/account", nil, headers)
	assert.Equal(suite.T(), http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "success", response["status"])

	// Verify user can no longer authenticate
	loginData := map[string]string{
		"username": newUser["username"].(string),
		"password": newUser["password"].(string),
	}

	w = suite.makeRequest("POST", "/auth/login", loginData, nil)
	assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
}

func (suite *IntegrationTestSuite) TestRateLimiting() {
	suite.Run("Login Rate Limiting", func() {
		suite.testLoginRateLimiting()
	})

	suite.Run("API Rate Limiting", func() {
		suite.testAPIRateLimiting()
	})
}

func (suite *IntegrationTestSuite) testLoginRateLimiting() {
	// Make multiple failed login attempts to trigger rate limiting
	loginData := map[string]string{
		"username": suite.testUser.Username,
		"password": "wrongpassword",
	}

	// Make several failed attempts
	for i := 0; i < 5; i++ {
		w := suite.makeRequest("POST", "/auth/login", loginData, nil)
		assert.Equal(suite.T(), http.StatusUnauthorized, w.Code)
	}

	// Next attempt should be rate limited
	w := suite.makeRequest("POST", "/auth/login", loginData, nil)
	assert.Equal(suite.T(), http.StatusTooManyRequests, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "error", response["status"])
	assert.Contains(suite.T(), response["message"], "rate limit exceeded")
}

func (suite *IntegrationTestSuite) testAPIRateLimiting() {
	suite.authenticateUser()

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	// Make multiple rapid requests to trigger rate limiting
	for i := 0; i < 50; i++ {
		w := suite.makeRequest("GET", "/users/profile", nil, headers)
		if w.Code == http.StatusTooManyRequests {
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(suite.T(), err)
			assert.Equal(suite.T(), "error", response["status"])
			assert.Contains(suite.T(), response["message"], "rate limit exceeded")
			return
		}
		assert.Equal(suite.T(), http.StatusOK, w.Code)
	}
}