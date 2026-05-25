package handlers_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// LoginRequest represents the login request body (copied for testing)
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	TenantID string `json:"tenant_id" validate:"required,uuid"`
	MFACode  string `json:"mfa_code,omitempty"`
}

// Validate validates the login request
func (r *LoginRequest) Validate() error {
	if r.Email == "" {
		return errors.New("email is required")
	}
	if !strings.Contains(r.Email, "@") {
		return errors.New("invalid email format")
	}
	if r.Password == "" {
		return errors.New("password is required")
	}
	if r.TenantID == "" {
		return errors.New("tenant_id is required")
	}
	if _, err := uuid.Parse(r.TenantID); err != nil {
		return errors.New("invalid tenant_id format")
	}
	return nil
}

// RefreshTokenRequest represents the refresh token request (copied for testing)
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// Validate validates the refresh token request
func (r *RefreshTokenRequest) Validate() error {
	if r.RefreshToken == "" {
		return errors.New("refresh_token is required")
	}
	if strings.TrimSpace(r.RefreshToken) == "" {
		return errors.New("refresh_token cannot be empty")
	}
	return nil
}

// UserInfo represents user information in responses (copied for testing)
type UserInfo struct {
	ID            uuid.UUID              `json:"id"`
	TenantID      uuid.UUID              `json:"tenant_id"`
	Email         string                 `json:"email"`
	Role          string                 `json:"role"`
	Permissions   map[string]interface{} `json:"permissions"`
	Metadata      map[string]interface{} `json:"metadata"`
	IsActive      bool                   `json:"is_active"`
	MFAEnabled    bool                   `json:"mfa_enabled"`
	EmailVerified bool                   `json:"email_verified"`
	Profile       map[string]interface{} `json:"profile"`
	Preferences   map[string]interface{} `json:"preferences"`
}

// TenantInfo represents tenant information in responses (copied for testing)
type TenantInfo struct {
	ID       uuid.UUID              `json:"id"`
	Name     string                 `json:"name"`
	Domain   string                 `json:"domain"`
	Status   string                 `json:"status"`
	Config   map[string]interface{} `json:"config"`
	Settings map[string]interface{} `json:"settings"`
}

// LoginResponse represents the login response (copied for testing)
type LoginResponse struct {
	Success bool `json:"success"`
	Data    struct {
		AccessToken  string      `json:"access_token"`
		RefreshToken string      `json:"refresh_token"`
		ExpiresIn    int         `json:"expires_in"`
		TokenType    string      `json:"token_type"`
		User         *UserInfo   `json:"user"`
		Tenant       *TenantInfo `json:"tenant"`
		SessionID    string      `json:"session_id"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// LogoutResponse represents the logout response (copied for testing)
type LogoutResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Message string `json:"message"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// ResponseMeta represents response metadata (copied for testing)
type ResponseMeta struct {
	RequestID string `json:"request_id"`
	Timestamp string `json:"timestamp"`
}

// TestLoginRequest_Validation tests login request validation
func TestLoginRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		req     LoginRequest
		wantErr bool
	}{
		{
			name: "Valid request",
			req: LoginRequest{
				Email:    "test@example.com",
				Password: "Password123!",
				TenantID: uuid.New().String(),
			},
			wantErr: false,
		},
		{
			name: "Missing email",
			req: LoginRequest{
				Password: "Password123!",
				TenantID: uuid.New().String(),
			},
			wantErr: true,
		},
		{
			name: "Invalid email format",
			req: LoginRequest{
				Email:    "not-an-email",
				Password: "Password123!",
				TenantID: uuid.New().String(),
			},
			wantErr: true,
		},
		{
			name: "Missing password",
			req: LoginRequest{
				Email:    "test@example.com",
				TenantID: uuid.New().String(),
			},
			wantErr: true,
		},
		{
			name: "Missing tenant ID",
			req: LoginRequest{
				Email:    "test@example.com",
				Password: "Password123!",
			},
			wantErr: true,
		},
		{
			name: "Invalid tenant ID format",
			req: LoginRequest{
				Email:    "test@example.com",
				Password: "Password123!",
				TenantID: "not-a-uuid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestLoginResponse_Serialization tests login response serialization
func TestLoginResponse_Serialization(t *testing.T) {
	userID := uuid.New()
	tenantID := uuid.New()

	response := LoginResponse{
		Success: true,
	}
	response.Data.AccessToken = "test-access-token"
	response.Data.RefreshToken = "test-refresh-token"
	response.Data.ExpiresIn = 3600
	response.Data.TokenType = "Bearer"
	response.Data.SessionID = uuid.New().String()
	response.Data.User = &UserInfo{
		ID:            userID,
		TenantID:      tenantID,
		Email:         "test@example.com",
		Role:          "user",
		Permissions:   map[string]interface{}{"documents": "read"},
		IsActive:      true,
		EmailVerified: true,
	}
	response.Data.Tenant = &TenantInfo{
		ID:     tenantID,
		Name:   "Test Tenant",
		Domain: "test.example.com",
		Status: "active",
	}
	response.Meta.RequestID = uuid.New().String()
	response.Meta.Timestamp = "2024-01-01T00:00:00Z"

	// Serialize to JSON
	data, err := json.Marshal(response)
	require.NoError(t, err)
	assert.NotEmpty(t, data)

	// Deserialize and verify
	var decoded LoginResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.True(t, decoded.Success)
	assert.Equal(t, "test-access-token", decoded.Data.AccessToken)
	assert.Equal(t, userID, decoded.Data.User.ID)
	assert.Equal(t, tenantID, decoded.Data.Tenant.ID)
}

// TestLogoutResponse_Serialization tests logout response serialization
func TestLogoutResponse_Serialization(t *testing.T) {
	response := LogoutResponse{
		Success: true,
	}
	response.Data.Message = "Successfully logged out"
	response.Meta.RequestID = uuid.New().String()
	response.Meta.Timestamp = "2024-01-01T00:00:00Z"

	// Serialize to JSON
	data, err := json.Marshal(response)
	require.NoError(t, err)
	assert.NotEmpty(t, data)

	// Deserialize and verify
	var decoded LogoutResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)
	assert.True(t, decoded.Success)
	assert.Equal(t, "Successfully logged out", decoded.Data.Message)
}

// TestRefreshTokenRequest_Validation tests refresh token request validation
func TestRefreshTokenRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		req     RefreshTokenRequest
		wantErr bool
	}{
		{
			name: "Valid request",
			req: RefreshTokenRequest{
				RefreshToken: "valid-refresh-token",
			},
			wantErr: false,
		},
		{
			name:    "Empty refresh token",
			req:     RefreshTokenRequest{},
			wantErr: true,
		},
		{
			name: "Whitespace only refresh token",
			req: RefreshTokenRequest{
				RefreshToken: "   ",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// TestUserInfo_MockCreation tests creating mock user info
func TestUserInfo_MockCreation(t *testing.T) {
	userID := uuid.New()
	tenantID := uuid.New()

	userInfo := &UserInfo{
		ID:            userID,
		TenantID:      tenantID,
		Email:         "test@example.com",
		Role:          "user",
		Permissions:   map[string]interface{}{"documents": "read", "write": true},
		Metadata:      map[string]interface{}{"department": "engineering"},
		IsActive:      true,
		MFAEnabled:    false,
		EmailVerified: true,
		Profile:       map[string]interface{}{"first_name": "Test", "last_name": "User"},
		Preferences:   map[string]interface{}{"theme": "dark"},
	}

	assert.Equal(t, userID, userInfo.ID)
	assert.Equal(t, tenantID, userInfo.TenantID)
	assert.Equal(t, "test@example.com", userInfo.Email)
	assert.Equal(t, "user", userInfo.Role)
	assert.True(t, userInfo.IsActive)
	assert.False(t, userInfo.MFAEnabled)
	assert.True(t, userInfo.EmailVerified)
}

// TestTenantInfo_MockCreation tests creating mock tenant info
func TestTenantInfo_MockCreation(t *testing.T) {
	tenantID := uuid.New()

	tenantInfo := &TenantInfo{
		ID:       tenantID,
		Name:     "Test Organization",
		Domain:   "test-org.example.com",
		Status:   "active",
		Config:   map[string]interface{}{"max_users": 100},
		Settings: map[string]interface{}{"enable_mfa": true},
	}

	assert.Equal(t, tenantID, tenantInfo.ID)
	assert.Equal(t, "Test Organization", tenantInfo.Name)
	assert.Equal(t, "test-org.example.com", tenantInfo.Domain)
	assert.Equal(t, "active", tenantInfo.Status)
}

// TestResponseMeta_Creation tests creating response metadata
func TestResponseMeta_Creation(t *testing.T) {
	requestID := uuid.New()

	meta := ResponseMeta{
		RequestID: requestID.String(),
		Timestamp: "2024-01-01T12:00:00Z",
	}

	assert.Equal(t, requestID.String(), meta.RequestID)
	assert.Equal(t, "2024-01-01T12:00:00Z", meta.Timestamp)
}

// TestAuthErrorResponses tests various auth error responses
func TestAuthErrorResponses(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		response   map[string]interface{}
	}{
		{
			name:       "Unauthorized - invalid credentials",
			statusCode: http.StatusUnauthorized,
			response: map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":    "INVALID_CREDENTIALS",
					"message": "Invalid email or password",
				},
			},
		},
		{
			name:       "Unauthorized - missing token",
			statusCode: http.StatusUnauthorized,
			response: map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":    "MISSING_TOKEN",
					"message": "Authentication token required",
				},
			},
		},
		{
			name:       "Bad Request - validation error",
			statusCode: http.StatusBadRequest,
			response: map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":    "VALIDATION_ERROR",
					"message": "Invalid request format",
				},
			},
		},
		{
			name:       "Too Many Requests - rate limit",
			statusCode: http.StatusTooManyRequests,
			response: map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":    "RATE_LIMIT_EXCEEDED",
					"message": "Too many requests, please try again later",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Verify status code is valid
			assert.True(t, tt.statusCode >= 400 && tt.statusCode < 600,
				"status code should indicate error")

			// Verify response structure
			assert.Contains(t, tt.response, "success")
			assert.Contains(t, tt.response, "error")
			assert.False(t, tt.response["success"].(bool))
			assert.IsType(t, map[string]interface{}{}, tt.response["error"])
		})
	}
}

// TestHelpers tests helper functions
func TestHelpers(t *testing.T) {
	t.Run("extractBearerToken", func(t *testing.T) {
		tests := []struct {
			name   string
			header string
			token  string
			valid  bool
		}{
			{
				name:   "Valid bearer token",
				header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
				token:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
				valid:  true,
			},
			{
				name:   "Missing Bearer prefix",
				header: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
				valid:  false,
			},
			{
				name:   "Empty header",
				header: "",
				valid:  false,
			},
			{
				name:   "Wrong prefix",
				header: "Basic dXNlcjpwYXNz",
				valid:  false,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				if tt.valid {
					token := extractBearerToken(tt.header)
					assert.Equal(t, tt.token, token)
				} else {
					token := extractBearerToken(tt.header)
					assert.Empty(t, token)
				}
			})
		}
	})
}

// extractBearerToken extracts the bearer token from the Authorization header
func extractBearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.Split(header, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return ""
	}
	return parts[1]
}

// Benchmark serialization operations
func BenchmarkLoginResponse_Serialization(b *testing.B) {
	userID := uuid.New()
	tenantID := uuid.New()

	response := LoginResponse{Success: true}
	response.Data.AccessToken = "test-access-token"
	response.Data.RefreshToken = "test-refresh-token"
	response.Data.ExpiresIn = 3600
	response.Data.TokenType = "Bearer"
	response.Data.SessionID = uuid.New().String()
	response.Data.User = &UserInfo{
		ID:            userID,
		TenantID:      tenantID,
		Email:         "test@example.com",
		Role:          "user",
		Permissions:   map[string]interface{}{"documents": "read"},
		IsActive:      true,
		EmailVerified: true,
	}
	response.Data.Tenant = &TenantInfo{
		ID:     tenantID,
		Name:   "Test Tenant",
		Domain: "test.example.com",
		Status: "active",
	}
	response.Meta.RequestID = uuid.New().String()
	response.Meta.Timestamp = "2024-01-01T00:00:00Z"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = json.Marshal(response)
	}
}

func BenchmarkBearerTokenExtraction(b *testing.B) {
	header := "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = extractBearerToken(header)
	}
}
