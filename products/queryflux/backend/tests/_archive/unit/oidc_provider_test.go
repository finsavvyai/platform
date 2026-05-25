package unit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"
	"github.com/queryflux/backend/internal/infrastructure/sso/providers"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestOIDCProviderCreation tests creating an OIDC provider
func TestOIDCProviderCreation(t *testing.T) {
	// Test with valid configuration
	config := &providers.OIDCConfig{
		ClientID:       "test-client-id",
		ClientSecret:   "test-client-secret",
		AuthURL:        "https://oidc.example.com/auth",
		TokenURL:       "https://oidc.example.com/token",
		UserInfoURL:    "https://oidc.example.com/userinfo",
		RedirectURL:    "https://app.example.com/callback",
		Scopes:         []string{oidc.ScopeOpenID, "email", "profile"},
	}

	provider, err := providers.NewOIDCProvider(config)
	assert.NoError(t, err)
	assert.NotNil(t, provider)

	// Test with empty configuration
	provider, err = providers.NewOIDCProvider(nil)
	assert.Error(t, err)
	assert.Nil(t, provider)

	// Test with minimal configuration
	minimalConfig := &providers.OIDCConfig{
		ClientID:    "test-client",
		RedirectURL: "https://app.example.com/callback",
	}

	provider, err = providers.NewOIDCProvider(minimalConfig)
	assert.NoError(t, err)
	assert.NotNil(t, provider)
}

// TestOIDCProviderFromIssuer tests creating provider from issuer URL
func TestOIDCProviderFromIssuer(t *testing.T) {
	// Create mock OIDC discovery server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			config := map[string]interface{}{
				"issuer":                 server.URL,
				"authorization_endpoint": server.URL + "/auth",
				"token_endpoint":         server.URL + "/token",
				"userinfo_endpoint":      server.URL + "/userinfo",
				"jwks_uri":              server.URL + "/keys",
			}
			json.NewEncoder(w).Encode(config)
		case "/keys":
			// Return empty key set for testing
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"keys":[]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create provider from issuer
	provider, err := providers.NewOIDCProviderFromIssuer(
		context.Background(),
		server.URL,
		"test-client",
		"test-secret",
		"https://app.example.com/callback",
		[]string{oidc.ScopeOpenID, "email"},
	)
	assert.NoError(t, err)
	assert.NotNil(t, provider)
}

// TestOIDCProviderGenerateAuthURL tests generating OIDC auth URLs
func TestOIDCProviderGenerateAuthURL(t *testing.T) {
	config := &providers.OIDCConfig{
		ClientID:    "test-client-id",
		AuthURL:     "https://oidc.example.com/auth",
		RedirectURL: "https://app.example.com/callback",
		Scopes:      []string{oidc.ScopeOpenID, "email"},
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Create mock session
	session := &MockSSOSession{
		ID:    "session123",
		State: "state123",
		Nonce: "nonce123",
	}

	// Generate auth URL
	authURL, err := provider.GenerateAuthURL(session)
	assert.NoError(t, err)
	assert.Contains(t, authURL, "response_type=code")
	assert.Contains(t, authURL, "client_id=test-client-id")
	assert.Contains(t, authURL, "redirect_uri="+url.QueryEscape("https://app.example.com/callback"))
	assert.Contains(t, authURL, "state=state123")
	assert.Contains(t, authURL, "nonce=nonce123")
	assert.Contains(t, authURL, "scope=openid+email")
}

// TestOIDCProviderExchangeCode tests exchanging authorization code for tokens
func TestOIDCProviderExchangeCode(t *testing.T) {
	// Create mock token endpoint server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			// Verify request contains authorization code
			r.ParseForm()
			assert.Equal(t, "authorization_code", r.Form.Get("grant_type"))
			assert.Equal(t, "test-auth-code", r.Form.Get("code"))
			assert.Equal(t, "test-client-id", r.Form.Get("client_id"))

			// Return mock token response
			response := map[string]interface{}{
				"access_token":  "mock-access-token",
				"token_type":    "Bearer",
				"expires_in":    3600,
				"refresh_token": "mock-refresh-token",
				"id_token":      "mock-id-token",
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
		}
	}))
	defer server.Close()

	config := &providers.OIDCConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		AuthURL:      server.URL + "/auth",
		TokenURL:     server.URL + "/token",
		RedirectURL:  "https://app.example.com/callback",
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Exchange code for token
	tokenResponse, err := provider.ExchangeCodeForToken(context.Background(), "test-auth-code")
	assert.NoError(t, err)
	assert.Equal(t, "mock-access-token", tokenResponse.AccessToken)
	assert.Equal(t, "Bearer", tokenResponse.TokenType)
	assert.Equal(t, 3600, tokenResponse.ExpiresIn)
	assert.Equal(t, "mock-refresh-token", tokenResponse.RefreshToken)
	assert.Equal(t, "mock-id-token", tokenResponse.IDToken)
}

// TestOIDCProviderGetUserInfo tests fetching user info
func TestOIDCProviderGetUserInfo(t *testing.T) {
	// Create mock user info endpoint
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/userinfo" {
			// Verify authorization header
			authHeader := r.Header.Get("Authorization")
			assert.Equal(t, "Bearer mock-access-token", authHeader)

			// Return mock user info
			userInfo := map[string]interface{}{
				"sub":            "user123",
				"name":           "Test User",
				"given_name":     "Test",
				"family_name":    "User",
				"email":          "test@example.com",
				"email_verified": true,
				"picture":        "https://example.com/avatar.jpg",
				"groups":         []string{"users", "developers"},
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(userInfo)
		}
	}))
	defer server.Close()

	config := &providers.OIDCConfig{
		ClientID:    "test-client-id",
		UserInfoURL: server.URL + "/userinfo",
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Get user info
	userInfo, err := provider.GetUserInfo(context.Background(), "mock-access-token")
	assert.NoError(t, err)
	assert.Equal(t, "user123", userInfo.Sub)
	assert.Equal(t, "Test User", userInfo.Name)
	assert.Equal(t, "Test", userInfo.GivenName)
	assert.Equal(t, "User", userInfo.FamilyName)
	assert.Equal(t, "test@example.com", userInfo.Email)
	assert.True(t, userInfo.EmailVerified)
	assert.Equal(t, "https://example.com/avatar.jpg", userInfo.Picture)
	assert.Contains(t, userInfo.Groups, "users")
	assert.Contains(t, userInfo.Groups, "developers")
}

// TestOIDCProviderRefreshToken tests refreshing access tokens
func TestOIDCProviderRefreshToken(t *testing.T) {
	// Create mock token endpoint
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			r.ParseForm()
			if r.Form.Get("grant_type") == "refresh_token" {
				// Return new token response
				response := map[string]interface{}{
					"access_token":  "new-access-token",
					"token_type":    "Bearer",
					"expires_in":    3600,
					"refresh_token": "new-refresh-token",
					"id_token":      "new-id-token",
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(response)
			}
		}
	}))
	defer server.Close()

	config := &providers.OIDCConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		TokenURL:     server.URL + "/token",
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Refresh token
	tokenResponse, err := provider.RefreshAccessToken(context.Background(), "old-refresh-token")
	assert.NoError(t, err)
	assert.Equal(t, "new-access-token", tokenResponse.AccessToken)
	assert.Equal(t, "new-refresh-token", tokenResponse.RefreshToken)
	assert.Equal(t, "new-id-token", tokenResponse.IDToken)
}

// TestOIDCProviderVerifyIDToken tests ID token verification
func TestOIDCProviderVerifyIDToken(t *testing.T) {
	config := &providers.OIDCConfig{
		ClientID:    "test-client-id",
		SkipVerify: true, // Skip verification for testing
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Create mock ID token (without proper signature for testing)
	// In real implementation, this would be a properly signed JWT
	mockIDToken := "header.payload.signature"

	// Verify ID token (with skip verification enabled)
	idToken, err := provider.VerifyIDToken(context.Background(), mockIDToken)
	assert.NoError(t, err)
	assert.NotNil(t, idToken)

	// Test with verification enabled
	config.SkipVerify = false
	provider, err = providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// This should fail with real verification
	_, err = provider.VerifyIDToken(context.Background(), mockIDToken)
	assert.Error(t, err)
}

// TestOIDCProviderRevokeToken tests token revocation
func TestOIDCProviderRevokeToken(t *testing.T) {
	// Create mock token endpoint with revocation
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			config := map[string]interface{}{
				"issuer":              server.URL,
				"revocation_endpoint": server.URL + "/revoke",
			}
			json.NewEncoder(w).Encode(config)
		case "/revoke":
			// Verify revocation request
			r.ParseForm()
			assert.Equal(t, "mock-access-token", r.Form.Get("token"))
			assert.Equal(t, "test-client-id", r.Form.Get("client_id"))
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	config := &providers.OIDCConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		TokenURL:     server.URL + "/token",
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Manually set provider discovery to use test server
	oidcProvider, _ := oidc.NewProvider(context.Background(), server.URL)
	provider.SetProvider(oidcProvider)

	// Revoke token
	err = provider.RevokeToken(context.Background(), "mock-access-token")
	assert.NoError(t, err)

	// Test revocation without endpoint support
	configWithoutRevocation := &providers.OIDCConfig{
		ClientID: "test-client-id",
	}
	providerWithoutRevocation, err := providers.NewOIDCProvider(configWithoutRevocation)
	require.NoError(t, err)

	err = providerWithoutRevocation.RevokeToken(context.Background(), "mock-access-token")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not supported")
}

// TestOIDCProviderUserInfoParsing tests parsing user info claims
func TestOIDCProviderUserInfoParsing(t *testing.T) {
	config := &providers.OIDCConfig{
		ClientID: "test-client-id",
	}

	provider, err := providers.NewOIDCProvider(config)
	require.NoError(t, err)

	// Test claims parsing
	claims := map[string]interface{}{
		"sub":            "user123",
		"name":           "Test User",
		"given_name":     "Test",
		"family_name":    "User",
		"email":          "test@example.com",
		"email_verified": true,
		"picture":        "https://example.com/avatar.jpg",
		"groups":         []interface{}{"users", "admin"},
		"custom_attr":    "custom_value",
	}

	userInfo, err := provider.parseUserInfo(claims)
	assert.NoError(t, err)
	assert.Equal(t, "user123", userInfo.Sub)
	assert.Equal(t, "Test User", userInfo.Name)
	assert.Equal(t, "test@example.com", userInfo.Email)
	assert.True(t, userInfo.EmailVerified)
	assert.Contains(t, userInfo.Groups, "users")
	assert.Contains(t, userInfo.Groups, "admin")
	assert.Equal(t, "custom_value", userInfo.Attributes["custom_attr"])
}

// MockSSOSession is a mock SSO session for testing
type MockSSOSession struct {
	ID    string
	State string
	Nonce string
}

// Additional helper functions for testing

func TestExtractIssuerURL(t *testing.T) {
	testCases := []struct {
		tokenURL     string
		expectedURL  string
		shouldFail   bool
	}{
		{
			tokenURL:    "https://auth.example.com/oauth2/token",
			expectedURL: "https://auth.example.com",
		},
		{
			tokenURL:    "https://auth.example.com:8080/token",
			expectedURL: "https://auth.example.com:8080",
		},
		{
			tokenURL:   "invalid-url",
			shouldFail: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.tokenURL, func(t *testing.T) {
			result := extractIssuerURL(tc.tokenURL)
			if tc.shouldFail {
				assert.Empty(t, result)
			} else {
				assert.Equal(t, tc.expectedURL, result)
			}
		})
	}
}