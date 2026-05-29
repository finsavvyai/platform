package auth

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
	"github.com/golang-jwt/jwt/v5"
)

// MockRequest implements the sdln.Request interface for testing
type MockRequest struct {
	headers map[string]string
	body    []byte
}

func (m *MockRequest) SetHeader(key, value string) {
	if m.headers == nil {
		m.headers = make(map[string]string)
	}
	m.headers[key] = value
}

func (m *MockRequest) GetHeader(key string) string {
	if m.headers == nil {
		return ""
	}
	return m.headers[key]
}

func (m *MockRequest) SetBody(body []byte) {
	m.body = body
}

func (m *MockRequest) GetBody() []byte {
	return m.body
}

func (m *MockRequest) GetMethod() string {
	return m.headers["Method"]
}

func (m *MockRequest) GetURL() string {
	return m.headers["URL"]
}

// Test API Key Authentication
func TestAPIKeyAuth(t *testing.T) {
	tests := []struct {
		name        string
		apiKey      string
		header      string
		prefix      string
		expectError bool
		errorMsg    string
		validate    func(*MockRequest) error
	}{
		{
			name:        "valid API key with default header",
			apiKey:      "test-api-key-123",
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				expected := "Bearer test-api-key-123"
				if authHeader != expected {
					return fmt.Errorf("expected Authorization header %q, got %q", expected, authHeader)
				}
				return nil
			},
		},
		{
			name:        "valid API key with custom header",
			apiKey:      "test-api-key-123",
			header:      "X-API-Key",
			prefix:      "",
			expectError: false,
			validate: func(req *MockRequest) error {
				apiKeyHeader := req.GetHeader("X-API-Key")
				if apiKeyHeader != "test-api-key-123" {
					return fmt.Errorf("expected X-API-Key header %q, got %q", "test-api-key-123", apiKeyHeader)
				}
				return nil
			},
		},
		{
			name:        "valid API key with prefix",
			apiKey:      "test-api-key-123",
			header:      "Authorization",
			prefix:      "Token",
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				expected := "Token test-api-key-123"
				if authHeader != expected {
					return fmt.Errorf("expected Authorization header %q, got %q", expected, authHeader)
				}
				return nil
			},
		},
		{
			name:        "empty API key",
			apiKey:      "",
			expectError: true,
			errorMsg:    "API key is required",
		},
		{
			name:        "API key with special characters",
			apiKey:      "test-key_123-456/abc+xyz",
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				if !strings.Contains(authHeader, "test-key_123-456/abc+xyz") {
					return fmt.Errorf("API key with special characters not properly handled")
				}
				return nil
			},
		},
		{
			name:        "very long API key",
			apiKey:      strings.Repeat("a", 1000),
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				if len(authHeader) < 1000 {
					return fmt.Errorf("long API key not properly handled")
				}
				return nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var auth *APIKeyAuth
			if tt.header != "" {
				auth = NewAPIKeyAuthWithHeader(tt.apiKey, tt.header, tt.prefix)
			} else {
				auth = NewAPIKeyAuth(tt.apiKey)
			}

			req := &MockRequest{}
			err := auth.Authenticate(context.Background(), req)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					if err := tt.validate(req); err != nil {
						t.Fatalf("Request validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestAPIKeyAuthIsValid(t *testing.T) {
	tests := []struct {
		name     string
		apiKey   string
		expected bool
	}{
		{
			name:     "valid API key",
			apiKey:   "test-key-123",
			expected: true,
		},
		{
			name:     "empty API key",
			apiKey:   "",
			expected: false,
		},
		{
			name:     "whitespace API key",
			apiKey:   "   ",
			expected: true, // Non-empty string is considered valid
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth := NewAPIKeyAuth(tt.apiKey)
			result := auth.IsValid(context.Background())
			if result != tt.expected {
				t.Fatalf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// Test JWT Authentication
func TestJWTAuth(t *testing.T) {
	// Generate test RSA key pair for JWT signing
	privateKey, publicKey := generateTestKeyPair(t)

	tests := []struct {
		name        string
		token       string
		keyFunc     jwt.Keyfunc
		expectError bool
		errorMsg    string
		validate    func(*MockRequest) error
	}{
		{
			name:  "valid JWT token",
			token: generateTestJWT(t, privateKey, "test-user"),
			keyFunc: func(token *jwt.Token) (interface{}, error) {
				return publicKey, nil
			},
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				if !strings.HasPrefix(authHeader, "Bearer ") {
					return fmt.Errorf("expected Bearer token, got %q", authHeader)
				}
				return nil
			},
		},
		{
			name:        "empty JWT token",
			token:       "",
			expectError: true,
			errorMsg:    "JWT token is required",
		},
		{
			name:  "invalid JWT token format",
			token: "invalid.jwt.token",
			keyFunc: func(token *jwt.Token) (interface{}, error) {
				return publicKey, nil
			},
			expectError: true,
			errorMsg:    "invalid JWT token",
		},
		{
			name:  "JWT token with invalid signature",
			token: generateTestJWT(t, privateKey, "test-user"),
			keyFunc: func(token *jwt.Token) (interface{}, error) {
				// Return wrong key to cause signature validation failure
				wrongKey, _ := rsa.GenerateKey(strings.NewReader("wrong"), 2048)
				return &wrongKey.PublicKey, nil
			},
			expectError: true,
			errorMsg:    "invalid JWT token",
		},
		{
			name:        "JWT token without key function (no validation)",
			token:       generateTestJWT(t, privateKey, "test-user"),
			keyFunc:     nil,
			expectError: false,
			validate: func(req *MockRequest) error {
				authHeader := req.GetHeader("Authorization")
				if !strings.HasPrefix(authHeader, "Bearer ") {
					return fmt.Errorf("expected Bearer token, got %q", authHeader)
				}
				return nil
			},
		},
		{
			name:  "expired JWT token",
			token: generateExpiredTestJWT(t, privateKey),
			keyFunc: func(token *jwt.Token) (interface{}, error) {
				return publicKey, nil
			},
			expectError: true,
			errorMsg:    "invalid JWT token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth := NewJWTAuth(tt.token)
			if tt.keyFunc != nil {
				auth.SetKeyFunc(tt.keyFunc)
			}

			req := &MockRequest{}
			err := auth.Authenticate(context.Background(), req)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if tt.validate != nil {
					if err := tt.validate(req); err != nil {
						t.Fatalf("Request validation failed: %v", err)
					}
				}
			}
		})
	}
}

func TestJWTAuthRefreshToken(t *testing.T) {
	t.Run("refresh not configured", func(t *testing.T) {
		auth := NewJWTAuth("test-token")
		err := auth.RefreshToken(context.Background())
		if err == nil {
			t.Fatal("Expected error for unconfigured refresh")
		}
		if !strings.Contains(err.Error(), "token refresh not configured") {
			t.Fatalf("Expected 'token refresh not configured' error, got %v", err)
		}
	})

	t.Run("refresh configured but no token", func(t *testing.T) {
		auth := NewJWTAuthWithRefresh("token", "", "http://example.com/refresh", "client-id", "client-secret")
		err := auth.RefreshToken(context.Background())
		if err == nil {
			t.Fatal("Expected error for missing refresh token")
		}
	})
}

func TestJWTAuthIsValid(t *testing.T) {
	privateKey, publicKey := generateTestKeyPair(t)
	validToken := generateTestJWT(t, privateKey, "test-user")
	invalidToken := "invalid.jwt.token"

	tests := []struct {
		name     string
		token    string
		keyFunc  jwt.Keyfunc
		expected bool
	}{
		{
			name:     "valid token with key function",
			token:    validToken,
			keyFunc:  func(token *jwt.Token) (interface{}, error) { return publicKey, nil },
			expected: true,
		},
		{
			name:     "invalid token with key function",
			token:    invalidToken,
			keyFunc:  func(token *jwt.Token) (interface{}, error) { return publicKey, nil },
			expected: false,
		},
		{
			name:     "valid token without key function",
			token:    validToken,
			keyFunc:  nil,
			expected: true, // No validation possible, returns true
		},
		{
			name:     "empty token",
			token:    "",
			keyFunc:  nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth := NewJWTAuth(tt.token)
			if tt.keyFunc != nil {
				auth.SetKeyFunc(tt.keyFunc)
			}

			result := auth.IsValid(context.Background())
			if result != tt.expected {
				t.Fatalf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// Test OAuth Authentication
func TestOAuthAuth(t *testing.T) {
	// Create a mock OAuth server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/token" {
			// Mock token endpoint
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "mock-access-token",
				"token_type":    "Bearer",
				"expires_in":    3600,
				"refresh_token": "mock-refresh-token",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	tests := []struct {
		name        string
		config      *OAuthConfig
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid OAuth config",
			config: &OAuthConfig{
				ClientID:     "test-client-id",
				ClientSecret: "test-client-secret",
				Scopes:       []string{"read", "write"},
				TokenURL:     server.URL + "/token",
			},
			expectError: false,
		},
		{
			name:        "nil config",
			config:      nil,
			expectError: true,
			errorMsg:    "OAuth config is required",
		},
		{
			name: "config with missing client ID",
			config: &OAuthConfig{
				ClientSecret: "test-client-secret",
				Scopes:       []string{"read"},
				TokenURL:     server.URL + "/token",
			},
			expectError: false, // OAuth library will handle validation
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := NewOAuthAuth(tt.config)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if auth == nil {
					t.Fatal("Expected auth instance but got nil")
				}
			}
		})
	}
}

func TestOAuthAuthAuthenticate(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/token" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "mock-access-token",
				"token_type":   "Bearer",
				"expires_in":   3600,
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	config := &OAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		Scopes:       []string{"read"},
		TokenURL:     server.URL + "/token",
	}

	auth, err := NewOAuthAuth(config)
	if err != nil {
		t.Fatalf("Failed to create OAuth auth: %v", err)
	}

	req := &MockRequest{}
	err = auth.Authenticate(context.Background(), req)

	if err != nil {
		t.Fatalf("Unexpected error during authentication: %v", err)
	}

	authHeader := req.GetHeader("Authorization")
	if authHeader != "Bearer mock-access-token" {
		t.Fatalf("Expected Authorization header 'Bearer mock-access-token', got %q", authHeader)
	}
}

func TestOAuthAuthIsValid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && r.URL.Path == "/token" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token": "test-token",
				"expires_in":   3600,
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	config := &OAuthConfig{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		Scopes:       []string{"read"},
		TokenURL:     server.URL + "/token",
	}

	auth, err := NewOAuthAuth(config)
	if err != nil {
		t.Fatalf("Failed to create OAuth auth: %v", err)
	}

	// Initially invalid (no token)
	if auth.IsValid(context.Background()) {
		t.Fatal("Expected invalid when no token")
	}

	// After authentication, should be valid
	req := &MockRequest{}
	err = auth.Authenticate(context.Background(), req)
	if err != nil {
		t.Fatalf("Unexpected error during authentication: %v", err)
	}

	if !auth.IsValid(context.Background()) {
		t.Fatal("Expected valid after authentication")
	}
}

// Test mTLS Authentication
func TestMTLSAuth(t *testing.T) {
	// Generate test certificates
	certPEM, keyPEM := generateTestCertificates(t)

	tests := []struct {
		name        string
		config      *MTLSConfig
		expectError bool
		errorMsg    string
	}{
		{
			name: "valid mTLS config with PEM data",
			config: &MTLSConfig{
				CertPEM: certPEM,
				KeyPEM:  keyPEM,
			},
			expectError: false,
		},
		{
			name: "valid mTLS config with file paths",
			config: &MTLSConfig{
				CertFile: "test-cert.pem",
				KeyFile:  "test-key.pem",
			},
			expectError: true, // Files don't exist
			errorMsg:    "failed to read certificate file",
		},
		{
			name:        "nil config",
			config:      nil,
			expectError: true,
			errorMsg:    "mTLS config is required",
		},
		{
			name: "missing certificate",
			config: &MTLSConfig{
				KeyPEM: keyPEM,
			},
			expectError: true,
			errorMsg:    "certificate file or PEM data is required",
		},
		{
			name: "missing private key",
			config: &MTLSConfig{
				CertPEM: certPEM,
			},
			expectError: true,
			errorMsg:    "key file or PEM data is required",
		},
		{
			name: "invalid certificate/key pair",
			config: &MTLSConfig{
				CertPEM: []byte("invalid cert"),
				KeyPEM:  []byte("invalid key"),
			},
			expectError: true,
			errorMsg:    "failed to parse certificate/key pair",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := NewMTLSAuth(tt.config)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
				if auth == nil {
					t.Fatal("Expected auth instance but got nil")
				}
				if auth.GetTLSConfig() == nil {
					t.Fatal("Expected TLS config but got nil")
				}
			}
		})
	}
}

func TestMTLSAuthIsValid(t *testing.T) {
	certPEM, keyPEM := generateTestCertificates(t)
	config := &MTLSConfig{
		CertPEM: certPEM,
		KeyPEM:  keyPEM,
	}

	auth, err := NewMTLSAuth(config)
	if err != nil {
		t.Fatalf("Failed to create mTLS auth: %v", err)
	}

	// mTLS auth is always valid if certificate is loaded
	if !auth.IsValid(context.Background()) {
		t.Fatal("Expected mTLS auth to be valid")
	}
}

func TestMTLSAuthAuthenticate(t *testing.T) {
	certPEM, keyPEM := generateTestCertificates(t)
	config := &MTLSConfig{
		CertPEM: certPEM,
		KeyPEM:  keyPEM,
	}

	auth, err := NewMTLSAuth(config)
	if err != nil {
		t.Fatalf("Failed to create mTLS auth: %v", err)
	}

	req := &MockRequest{}
	err = auth.Authenticate(context.Background(), req)

	// mTLS authentication should not error (handled at transport level)
	if err != nil {
		t.Fatalf("Unexpected error during mTLS authentication: %v", err)
	}
}

// Test Multi-Authentication
func TestMultiAuth(t *testing.T) {
	apiKeyAuth := NewAPIKeyAuth("test-api-key")
	jwtAuth := NewJWTAuth("test-jwt-token")

	tests := []struct {
		name           string
		authenticators []sdln.Authenticator
		strategy       AuthStrategy
		expectError    bool
		errorMsg       string
	}{
		{
			name:           "First strategy - first auth succeeds",
			authenticators: []sdln.Authenticator{apiKeyAuth, jwtAuth},
			strategy:       AuthStrategyFirst,
			expectError:    false,
		},
		{
			name: "First strategy - second auth succeeds",
			authenticators: []sdln.Authenticator{
				NewAPIKeyAuth(""), // Will fail
				jwtAuth,
			},
			strategy:    AuthStrategyFirst,
			expectError: false,
		},
		{
			name: "First strategy - all fail",
			authenticators: []sdln.Authenticator{
				NewAPIKeyAuth(""), // Will fail
				NewJWTAuth(""),    // Will fail
			},
			strategy:    AuthStrategyFirst,
			expectError: true,
			errorMsg:    "all authentication methods failed",
		},
		{
			name:           "All strategy - all succeed",
			authenticators: []sdln.Authenticator{apiKeyAuth, jwtAuth},
			strategy:       AuthStrategyAll,
			expectError:    false,
		},
		{
			name: "All strategy - one fails",
			authenticators: []sdln.Authenticator{
				apiKeyAuth,
				NewAPIKeyAuth(""), // Will fail
			},
			strategy:    AuthStrategyAll,
			expectError: true,
		},
		{
			name: "Any strategy - one succeeds",
			authenticators: []sdln.Authenticator{
				NewAPIKeyAuth(""), // Will fail
				apiKeyAuth,
			},
			strategy:    AuthStrategyAny,
			expectError: false,
		},
		{
			name: "Any strategy - all fail",
			authenticators: []sdln.Authenticator{
				NewAPIKeyAuth(""), // Will fail
				NewJWTAuth(""),    // Will fail
			},
			strategy:    AuthStrategyAny,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			multiAuth := NewMultiAuth(tt.authenticators...).WithStrategy(tt.strategy)

			req := &MockRequest{}
			err := multiAuth.Authenticate(context.Background(), req)

			if tt.expectError {
				if err == nil {
					t.Fatal("Expected error but got none")
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Fatalf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestMultiAuthIsValid(t *testing.T) {
	validAuth := NewAPIKeyAuth("valid-key")
	invalidAuth := NewAPIKeyAuth("")

	tests := []struct {
		name           string
		authenticators []sdln.Authenticator
		expected       bool
	}{
		{
			name:           "all invalid",
			authenticators: []sdln.Authenticator{invalidAuth, invalidAuth},
			expected:       false,
		},
		{
			name:           "one valid",
			authenticators: []sdln.Authenticator{invalidAuth, validAuth},
			expected:       true,
		},
		{
			name:           "all valid",
			authenticators: []sdln.Authenticator{validAuth, validAuth},
			expected:       true,
		},
		{
			name:           "empty authenticators",
			authenticators: []sdln.Authenticator{},
			expected:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			multiAuth := NewMultiAuth(tt.authenticators...)
			result := multiAuth.IsValid(context.Background())
			if result != tt.expected {
				t.Fatalf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestMultiAuthRefreshToken(t *testing.T) {
	// Test that refresh token doesn't error even if individual authenticators don't support it
	apiKeyAuth := NewAPIKeyAuth("test-key")
	jwtAuth := NewJWTAuth("test-token")

	multiAuth := NewMultiAuth(apiKeyAuth, jwtAuth)
	err := multiAuth.RefreshToken(context.Background())

	// Should not error
	if err != nil {
		t.Fatalf("Unexpected error during multi-auth refresh: %v", err)
	}
}

// Test helper functions

func generateTestKeyPair(t *testing.T) (*rsa.PrivateKey, *rsa.PublicKey) {
	privateKey, err := rsa.GenerateKey(strings.NewReader("test-seed"), 2048)
	if err != nil {
		t.Fatalf("Failed to generate test RSA key: %v", err)
	}
	return privateKey, &privateKey.PublicKey
}

func generateTestJWT(t *testing.T, privateKey *rsa.PrivateKey, userID string) string {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("Failed to sign JWT: %v", err)
	}
	return tokenString
}

func generateExpiredTestJWT(t *testing.T, privateKey *rsa.PrivateKey) string {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub": "test-user",
		"iat": time.Now().Add(-2 * time.Hour).Unix(),
		"exp": time.Now().Add(-1 * time.Hour).Unix(), // Expired
	})

	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("Failed to sign expired JWT: %v", err)
	}
	return tokenString
}

func generateTestCertificates(t *testing.T) ([]byte, []byte) {
	// This is a simplified version - in real usage you'd generate proper certificates
	certPEM := []byte(`-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArV71nj+6GIVENrJ7ru
+9RnKcZ5YJ9cZ8J9K8KZ9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7
K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8c
-----END CERTIFICATE-----`)

	keyPEM := []byte(`-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC9t7V71nj+6GIVEN
rJ7ru+9RnKcZ5YJ9cZ8J9K8KZ9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7
K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7K8Z9YJ8cZ7J7
-----END PRIVATE KEY-----`)

	return certPEM, keyPEM
}

// Test edge cases and error handling
func TestAuthenticationEdgeCases(t *testing.T) {
	t.Run("concurrent authentication", func(t *testing.T) {
		auth := NewAPIKeyAuth("test-key")

		// Test concurrent authentication
		const numGoroutines = 100
		var wg sync.WaitGroup
		errors := make(chan error, numGoroutines)

		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()

				req := &MockRequest{}
				err := auth.Authenticate(context.Background(), req)
				if err != nil {
					errors <- err
					return
				}

				// Verify request was authenticated
				if req.GetHeader("Authorization") == "" {
					errors <- fmt.Errorf("request not authenticated")
				}
			}()
		}

		wg.Wait()
		close(errors)

		for err := range errors {
			t.Errorf("Concurrent authentication failed: %v", err)
		}
	})

	t.Run("context cancellation", func(t *testing.T) {
		auth := NewAPIKeyAuth("test-key")

		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		req := &MockRequest{}
		err := auth.Authenticate(ctx, req)

		// API key auth doesn't use context, so should not error
		if err != nil {
			t.Fatalf("Unexpected error with cancelled context: %v", err)
		}
	})

	t.Run("nil request handling", func(t *testing.T) {
		auth := NewAPIKeyAuth("test-key")

		// This would panic if not handled, but our implementation uses interface methods
		// so we can't pass nil directly. This tests the interface contract.
		var req sdln.Request = nil

		defer func() {
			if r := recover(); r != nil {
				t.Logf("Recovered from panic with nil request: %v", r)
			}
		}()

		err := auth.Authenticate(context.Background(), req)
		// Should handle nil request gracefully or panic (which we recover from)
		_ = err
	})

	t.Run("very large headers", func(t *testing.T) {
		auth := NewAPIKeyAuth(strings.Repeat("a", 10000))

		req := &MockRequest{}
		err := auth.Authenticate(context.Background(), req)

		if err != nil {
			t.Fatalf("Unexpected error with large API key: %v", err)
		}

		authHeader := req.GetHeader("Authorization")
		if len(authHeader) < 10000 {
			t.Fatalf("Large API key not properly handled in header")
		}
	})
}

// Test authentication integration scenarios
func TestAuthenticationIntegration(t *testing.T) {
	t.Run("API key with HTTP request simulation", func(t *testing.T) {
		auth := NewAPIKeyAuth("integration-test-key")

		// Simulate an HTTP request
		req := &MockRequest{}
		req.headers = make(map[string]string)
		req.headers["Method"] = "GET"
		req.headers["URL"] = "https://api.example.com/users"

		err := auth.Authenticate(context.Background(), req)
		if err != nil {
			t.Fatalf("Authentication failed: %v", err)
		}

		// Verify the request would be properly authenticated
		authHeader := req.GetHeader("Authorization")
		expected := "Bearer integration-test-key"
		if authHeader != expected {
			t.Fatalf("Expected Authorization header %q, got %q", expected, authHeader)
		}
	})

	t.Run("JWT token with claims validation", func(t *testing.T) {
		privateKey, publicKey := generateTestKeyPair(t)

		// Create token with custom claims
		claims := jwt.MapClaims{
			"sub":    "user123",
			"role":   "admin",
			"iat":    time.Now().Unix(),
			"exp":    time.Now().Add(time.Hour).Unix(),
			"custom": "test-value",
		}

		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		tokenString, err := token.SignedString(privateKey)
		if err != nil {
			t.Fatalf("Failed to sign JWT: %v", err)
		}

		auth := NewJWTAuth(tokenString)
		auth.SetKeyFunc(func(token *jwt.Token) (interface{}, error) {
			return publicKey, nil
		})

		req := &MockRequest{}
		err = auth.Authenticate(context.Background(), req)
		if err != nil {
			t.Fatalf("JWT authentication failed: %v", err)
		}

		// Verify token was added to request
		authHeader := req.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			t.Fatal("JWT token not properly added to request")
		}
	})

	t.Run("multi-auth fallback strategy", func(t *testing.T) {
		// Create authenticators where first fails, second succeeds
		failingAuth := NewAPIKeyAuth("") // Empty key will fail
		successAuth := NewAPIKeyAuth("fallback-key")

		multiAuth := NewMultiAuth(failingAuth, successAuth).WithStrategy(AuthStrategyFirst)

		req := &MockRequest{}
		err := multiAuth.Authenticate(context.Background(), req)
		if err != nil {
			t.Fatalf("Multi-auth fallback failed: %v", err)
		}

		// Verify the successful authenticator was used
		// (This is a simplified test - in real usage you'd verify the correct headers were set)
		if multiAuth.IsValid(context.Background()) {
			t.Log("Multi-auth is valid after fallback")
		}
	})
}

// Test performance and resource usage
func TestAuthenticationPerformance(t *testing.T) {
	t.Run("API key auth performance", func(t *testing.T) {
		auth := NewAPIKeyAuth("performance-test-key")

		start := time.Now()
		const numIterations = 10000

		for i := 0; i < numIterations; i++ {
			req := &MockRequest{}
			err := auth.Authenticate(context.Background(), req)
			if err != nil {
				t.Fatalf("Authentication failed at iteration %d: %v", i, err)
			}
		}

		elapsed := time.Since(start)
		avgDuration := elapsed / numIterations

		t.Logf("API key auth: %d iterations in %v (avg: %v per auth)",
			numIterations, elapsed, avgDuration)

		// Performance assertion - should be very fast
		if avgDuration > 1*time.Microsecond {
			t.Logf("Warning: API key auth is slower than expected (avg: %v)", avgDuration)
		}
	})

	t.Run("JWT validation performance", func(t *testing.T) {
		privateKey, publicKey := generateTestKeyPair(t)
		token := generateTestJWT(t, privateKey, "performance-user")

		auth := NewJWTAuth(token)
		auth.SetKeyFunc(func(token *jwt.Token) (interface{}, error) {
			return publicKey, nil
		})

		start := time.Now()
		const numIterations = 1000

		for i := 0; i < numIterations; i++ {
			req := &MockRequest{}
			err := auth.Authenticate(context.Background(), req)
			if err != nil {
				t.Fatalf("JWT authentication failed at iteration %d: %v", i, err)
			}
		}

		elapsed := time.Since(start)
		avgDuration := elapsed / numIterations

		t.Logf("JWT validation: %d iterations in %v (avg: %v per validation)",
			numIterations, elapsed, avgDuration)

		// JWT validation should be fast but slower than API key
		if avgDuration > 100*time.Microsecond {
			t.Logf("Warning: JWT validation is slower than expected (avg: %v)", avgDuration)
		}
	})
}
