package auth

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockOAuthTokenStorage implements OAuthTokenStorage for testing
type MockOAuthTokenStorage struct {
	tokens map[string]*OAuthToken
}

func NewMockOAuthTokenStorage() *MockOAuthTokenStorage {
	return &MockOAuthTokenStorage{
		tokens: make(map[string]*OAuthToken),
	}
}

func (m *MockOAuthTokenStorage) StoreToken(ctx context.Context, userID, provider string, token *OAuthToken) error {
	key := userID + ":" + provider
	m.tokens[key] = token
	return nil
}

func (m *MockOAuthTokenStorage) GetToken(ctx context.Context, userID, provider string) (*OAuthToken, error) {
	key := userID + ":" + provider
	token, exists := m.tokens[key]
	if !exists {
		return nil, fmt.Errorf("token not found")
	}
	return token, nil
}

func (m *MockOAuthTokenStorage) DeleteToken(ctx context.Context, userID, provider string) error {
	key := userID + ":" + provider
	delete(m.tokens, key)
	return nil
}

func (m *MockOAuthTokenStorage) RefreshToken(ctx context.Context, userID, provider string) (*OAuthToken, error) {
	token, err := m.GetToken(ctx, userID, provider)
	if err != nil {
		return nil, err
	}
	// Simulate token refresh
	token.ExpiresAt = time.Now().Add(time.Hour)
	return token, nil
}

func TestOAuthService_NewOAuthService(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Check default providers are initialized
	supportedProviders := service.GetSupportedProviders()
	assert.Contains(t, supportedProviders, "google")
	assert.Contains(t, supportedProviders, "github")
	assert.Contains(t, supportedProviders, "microsoft")
	assert.Contains(t, supportedProviders, "linkedin")
}

func TestOAuthService_ConfigureProvider(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Configure Google provider
	err := service.ConfigureProvider("google", "test-client-id", "test-client-secret", "https://example.com/callback")
	require.NoError(t, err)

	config := service.GetProviderConfig("google")
	require.NotNil(t, config)
	assert.Equal(t, "Google", config.Name)
	assert.True(t, config.Enabled)

	// Try to configure non-existent provider
	err = service.ConfigureProvider("nonexistent", "id", "secret", "callback")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported OAuth provider")
}

func TestOAuthService_GenerateAuthURL(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Configure provider first
	err := service.ConfigureProvider("google", "test-client-id", "test-client-secret", "https://example.com/callback")
	require.NoError(t, err)

	// Generate auth URL
	req := &OAuthAuthURLRequest{
		Provider: "google",
		State:    "test-state",
		Prompt:   "consent",
	}

	resp, err := service.GenerateAuthURL(context.Background(), req)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.AuthURL)
	assert.Equal(t, "test-state", resp.State)
	assert.Contains(t, resp.AuthURL, "accounts.google.com")
	assert.Contains(t, resp.AuthURL, "client_id=test-client-id")
	assert.Contains(t, resp.AuthURL, "state=test-state")

	// Generate auth URL without state (should auto-generate)
	req.State = ""
	resp, err = service.GenerateAuthURL(context.Background(), req)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.State)
	assert.Len(t, resp.State, 44) // Base64 encoded 32 bytes

	// Test with unconfigured provider
	req.Provider = "github"
	resp, err = service.GenerateAuthURL(context.Background(), req)
	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Contains(t, err.Error(), "not configured")
}

func TestOAuthService_IsProviderConfigured(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Check unconfigured provider
	assert.False(t, service.IsProviderConfigured("google"))

	// Configure provider
	err := service.ConfigureProvider("google", "test-client-id", "test-client-secret", "https://example.com/callback")
	require.NoError(t, err)

	// Check configured provider
	assert.True(t, service.IsProviderConfigured("google"))

	// Check non-existent provider
	assert.False(t, service.IsProviderConfigured("nonexistent"))
}

func TestOAuthService_SupportedProviders(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	providers := service.GetSupportedProviders()
	assert.Len(t, providers, 4) // google, github, microsoft, linkedin
	assert.Contains(t, providers, "google")
	assert.Contains(t, providers, "github")
	assert.Contains(t, providers, "microsoft")
	assert.Contains(t, providers, "linkedin")
}

func TestOAuthService_ProviderConfigurations(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Test Google config
	googleConfig := service.GetProviderConfig("google")
	require.NotNil(t, googleConfig)
	assert.Equal(t, "Google", googleConfig.Name)
	assert.Equal(t, "https://accounts.google.com/o/oauth2/v2/auth", googleConfig.AuthURL)
	assert.Equal(t, "https://oauth2.googleapis.com/token", googleConfig.TokenURL)
	assert.Equal(t, "https://www.googleapis.com/oauth2/v2/userinfo", googleConfig.UserInfoURL)
	assert.Contains(t, googleConfig.Scopes, "openid")
	assert.Contains(t, googleConfig.Scopes, "email")
	assert.Contains(t, googleConfig.FieldMapping, "email")
	assert.Equal(t, "email", googleConfig.FieldMapping["email"])

	// Test GitHub config
	githubConfig := service.GetProviderConfig("github")
	require.NotNil(t, githubConfig)
	assert.Equal(t, "GitHub", githubConfig.Name)
	assert.Equal(t, "https://github.com/login/oauth/authorize", githubConfig.AuthURL)
	assert.Equal(t, "user:email", githubConfig.Scopes[0])

	// Test Microsoft config
	microsoftConfig := service.GetProviderConfig("microsoft")
	require.NotNil(t, microsoftConfig)
	assert.Equal(t, "Microsoft", microsoftConfig.Name)
	assert.Equal(t, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", microsoftConfig.AuthURL)

	// Test LinkedIn config
	linkedinConfig := service.GetProviderConfig("linkedin")
	require.NotNil(t, linkedinConfig)
	assert.Equal(t, "LinkedIn", linkedinConfig.Name)
	assert.Equal(t, "https://www.linkedin.com/oauth/v2/authorization", linkedinConfig.AuthURL)

	// Test non-existent provider
	nonExistentConfig := service.GetProviderConfig("nonexistent")
	assert.Nil(t, nonExistentConfig)
}

func TestOAuthService_TokenStorage(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	token := &OAuthToken{
		AccessToken:  "test-access-token",
		TokenType:    "Bearer",
		RefreshToken: "test-refresh-token",
		ExpiresAt:    time.Now().Add(time.Hour),
		Scope:        "openid email profile",
		Provider:     "google",
		CreatedAt:    time.Now(),
	}

	// Store token
	err := service.StoreToken(context.Background(), "user123", token)
	require.NoError(t, err)

	// Get token
	retrievedToken, err := service.GetToken(context.Background(), "user123", "google")
	require.NoError(t, err)
	assert.Equal(t, token.AccessToken, retrievedToken.AccessToken)
	assert.Equal(t, token.TokenType, retrievedToken.TokenType)
	assert.Equal(t, token.Provider, retrievedToken.Provider)

	// Refresh token
	refreshedToken, err := service.RefreshToken(context.Background(), "user123", "google")
	require.NoError(t, err)
	assert.True(t, refreshedToken.ExpiresAt.After(token.ExpiresAt))

	// Delete token
	err = service.DeleteToken(context.Background(), "user123", "google")
	require.NoError(t, err)

	// Try to get deleted token
	_, err = service.GetToken(context.Background(), "user123", "google")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "token not found")
}

func TestOAuthService_ValidateUserInfo(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Valid user info
	validUserInfo := &OAuthUserInfo{
		ID:    "12345",
		Email: "test@example.com",
		Name:  "Test User",
	}
	err := service.ValidateUserInfo(validUserInfo)
	assert.NoError(t, err)

	// Missing ID
	invalidUserInfo := &OAuthUserInfo{
		Email: "test@example.com",
		Name:  "Test User",
	}
	err = service.ValidateUserInfo(invalidUserInfo)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "user ID is required")

	// Missing email
	invalidUserInfo = &OAuthUserInfo{
		ID:   "12345",
		Name: "Test User",
	}
	err = service.ValidateUserInfo(invalidUserInfo)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "email is required")

	// Invalid email format
	invalidUserInfo = &OAuthUserInfo{
		ID:    "12345",
		Email: "invalid-email",
		Name:  "Test User",
	}
	err = service.ValidateUserInfo(invalidUserInfo)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid email format")
}

func TestOAuthService_GenerateSecureToken(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Generate tokens multiple times
	token1 := service.generateSecureToken(32)
	token2 := service.generateSecureToken(32)
	token3 := service.generateSecureToken(16)

	// Tokens should be different
	assert.NotEqual(t, token1, token2)
	assert.NotEqual(t, token1, token3)
	assert.NotEqual(t, token2, token3)

	// Check length (base64 encoding increases length)
	assert.Greater(t, len(token1), 32)
	assert.Greater(t, len(token2), 32)
	assert.Greater(t, len(token3), 16)
}

func TestOAuthService_ValidateState(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	state := "test-state-123"

	// Valid state
	assert.True(t, service.ValidateState(state, state))

	// Invalid state
	assert.False(t, service.ValidateState(state, "different-state"))
	assert.False(t, service.ValidateState(state, ""))
}

func TestOAuthService_ExtractEmailFromRawData(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Test GitHub raw data
	githubData := map[string]interface{}{
		"id":    12345,
		"login": "testuser",
		"email": "test@example.com",
		"name":  "Test User",
	}
	email := service.ExtractEmailFromRawData(githubData, "github")
	assert.Equal(t, "test@example.com", email)

	// Test Microsoft raw data with different email fields
	microsoftData := map[string]interface{}{
		"id":                "12345",
		"displayName":       "Test User",
		"userPrincipalName": "test@domain.com",
	}
	email = service.ExtractEmailFromRawData(microsoftData, "microsoft")
	assert.Equal(t, "test@domain.com", email)

	// Test Microsoft data with mail field
	microsoftData = map[string]interface{}{
		"id":   "12345",
		"mail": "test@company.com",
		"name": "Test User",
	}
	email = service.ExtractEmailFromRawData(microsoftData, "microsoft")
	assert.Equal(t, "test@company.com", email)

	// Test generic provider
	genericData := map[string]interface{}{
		"id":    "12345",
		"name":  "Test User",
		"email": "test@example.com",
	}
	email = service.ExtractEmailFromRawData(genericData, "generic")
	assert.Equal(t, "test@example.com", email)

	// Test no email found
	noEmailData := map[string]interface{}{
		"id":   "12345",
		"name": "Test User",
	}
	email = service.ExtractEmailFromRawData(noEmailData, "generic")
	assert.Equal(t, "", email)
}

func TestOAuthService_MapFieldToUserInfo(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	userInfo := &OAuthUserInfo{}

	// Test string mapping
	service.mapFieldToUserInfo(userInfo, "email", "test@example.com")
	assert.Equal(t, "test@example.com", userInfo.Email)

	// Test numeric ID mapping
	service.mapFieldToUserInfo(userInfo, "id", 12345.0)
	assert.Equal(t, "12345", userInfo.ID)

	// Test boolean mapping
	service.mapFieldToUserInfo(userInfo, "email_verified", true)
	assert.True(t, userInfo.EmailVerified)

	// Test name mapping
	service.mapFieldToUserInfo(userInfo, "name", "John Doe")
	assert.Equal(t, "John Doe", userInfo.Name)

	// Test name components
	service.mapFieldToUserInfo(userInfo, "first_name", "John")
	service.mapFieldToUserInfo(userInfo, "last_name", "Doe")
	assert.Equal(t, "John", userInfo.FirstName)
	assert.Equal(t, "Doe", userInfo.LastName)

	// Test avatar mapping
	service.mapFieldToUserInfo(userInfo, "avatar", "https://example.com/avatar.jpg")
	assert.Equal(t, "https://example.com/avatar.jpg", userInfo.Avatar)

	// Test username mapping
	service.mapFieldToUserInfo(userInfo, "username", "johndoe")
	assert.Equal(t, "johndoe", userInfo.Username)

	// Test locale mapping
	service.mapFieldToUserInfo(userInfo, "locale", "en-US")
	assert.Equal(t, "en-US", userInfo.Locale)
}

func TestOAuthService_RevokeToken(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	token := &OAuthToken{
		AccessToken: "test-token",
		Provider:    "google",
	}

	// Store token
	err := service.StoreToken(context.Background(), "user123", token)
	require.NoError(t, err)

	// Verify token exists
	_, err = service.GetToken(context.Background(), "user123", "google")
	assert.NoError(t, err)

	// Revoke token
	err = service.RevokeToken(context.Background(), "user123", "google")
	require.NoError(t, err)

	// Verify token is deleted
	_, err = service.GetToken(context.Background(), "user123", "google")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "token not found")
}

func TestOAuthService_GetConnectedProviders(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// This is a placeholder implementation
	providers, err := service.GetConnectedProviders(context.Background(), "user123")
	assert.NoError(t, err)
	assert.Empty(t, providers)
}

func TestOAuthProviderConfig_CopyWithoutSecrets(t *testing.T) {
	storage := NewMockOAuthTokenStorage()
	service := NewOAuthService(storage)

	// Configure provider with secrets
	err := service.ConfigureProvider("google", "secret-client-id", "secret-client-secret", "https://example.com/callback")
	require.NoError(t, err)

	// Get config without secrets
	config := service.GetProviderConfig("google")
	require.NotNil(t, config)
	assert.Equal(t, "Google", config.Name)
	assert.Empty(t, config.ClientID)     // Should not include secrets
	assert.Empty(t, config.ClientSecret) // Should not include secrets
	assert.Equal(t, "https://accounts.google.com/o/oauth2/v2/auth", config.AuthURL)
}
