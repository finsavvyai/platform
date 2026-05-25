package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// generateTestKey generates an RSA key for testing.
func generateTestKey() (*rsa.PrivateKey, error) {
	return rsa.GenerateKey(rand.Reader, 2048)
}

// createTestToken creates a JWT token for testing.
func createTestToken(privateKey *rsa.PrivateKey, issuer, audience string) (string, error) {
	claims := jwt.MapClaims{
		"sub":       "user123",
		"tenant_id": "tenant456",
		"email":     "user@example.com",
		"roles":     []string{"admin"},
		"iss":       issuer,
		"aud":       audience,
		"exp":       time.Now().Add(1 * time.Hour).Unix(),
		"iat":       time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key"

	return token.SignedString(privateKey)
}

func TestNewOpenSyberAuth_Disabled(t *testing.T) {
	auth, err := New(Config{Enabled: false})
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
	if auth != nil {
		t.Error("expected nil auth when disabled")
	}
}

func TestOpenSyberAuth_ValidateToken_NoPublicKeys(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(JWKS{Keys: []JWK{}})
	}))
	defer server.Close()

	_, err := New(Config{
		Enabled:      true,
		PublicKeyURL: server.URL + "/jwks.json",
		Issuer:       "test",
		Audience:     "pipewarden",
	})
	if err == nil {
		t.Error("expected error for no valid keys")
	}
}

func TestOpenSyberAuth_ValidateToken_Valid(t *testing.T) {
	privKey, err := generateTestKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	// Create JWKS response
	pubKey := &privKey.PublicKey
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simplified JWKS with RSA key
		jwks := JWKS{
			Keys: []JWK{
				{
					Kid: "test-key",
					Kty: "RSA",
					Use: "sig",
					N:   encodeBase64URL(pubKey.N.Bytes()),
					E:   encodeBase64URL(big.NewInt(int64(pubKey.E)).Bytes()),
				},
			},
		}
		_ = json.NewEncoder(w).Encode(jwks)
	}))
	defer server.Close()

	auth, err := New(Config{
		Enabled:      true,
		PublicKeyURL: server.URL + "/jwks.json",
		Issuer:       "test-issuer",
		Audience:     "pipewarden",
	})
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tokenStr, err := createTestToken(privKey, "test-issuer", "pipewarden")
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	claims, err := auth.ValidateToken(tokenStr)
	if err != nil {
		t.Fatalf("failed to validate token: %v", err)
	}

	if claims.UserID != "user123" {
		t.Errorf("expected UserID=user123, got %s", claims.UserID)
	}
	if claims.TenantID != "tenant456" {
		t.Errorf("expected TenantID=tenant456, got %s", claims.TenantID)
	}
	if claims.Email != "user@example.com" {
		t.Errorf("expected Email=user@example.com, got %s", claims.Email)
	}
}

func TestOpenSyberAuth_ValidateToken_InvalidIssuer(t *testing.T) {
	privKey, err := generateTestKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	pubKey := &privKey.PublicKey
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jwks := JWKS{
			Keys: []JWK{
				{
					Kid: "test-key",
					Kty: "RSA",
					Use: "sig",
					N:   encodeBase64URL(pubKey.N.Bytes()),
					E:   encodeBase64URL(big.NewInt(int64(pubKey.E)).Bytes()),
				},
			},
		}
		_ = json.NewEncoder(w).Encode(jwks)
	}))
	defer server.Close()

	auth, err := New(Config{
		Enabled:      true,
		PublicKeyURL: server.URL + "/jwks.json",
		Issuer:       "valid-issuer",
		Audience:     "pipewarden",
	})
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tokenStr, err := createTestToken(privKey, "wrong-issuer", "pipewarden")
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	_, err = auth.ValidateToken(tokenStr)
	if err == nil {
		t.Error("expected error for invalid issuer")
	}
}

func TestOpenSyberAuth_Middleware(t *testing.T) {
	privKey, err := generateTestKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	pubKey := &privKey.PublicKey
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		jwks := JWKS{
			Keys: []JWK{
				{
					Kid: "test-key",
					Kty: "RSA",
					Use: "sig",
					N:   encodeBase64URL(pubKey.N.Bytes()),
					E:   encodeBase64URL(big.NewInt(int64(pubKey.E)).Bytes()),
				},
			},
		}
		_ = json.NewEncoder(w).Encode(jwks)
	}))
	defer server.Close()

	auth, err := New(Config{
		Enabled:      true,
		PublicKeyURL: server.URL + "/jwks.json",
		Issuer:       "test-issuer",
		Audience:     "pipewarden",
	})
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tokenStr, err := createTestToken(privKey, "test-issuer", "pipewarden")
	if err != nil {
		t.Fatalf("failed to create token: %v", err)
	}

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		if UserIDFromContext(r.Context()) != "user123" {
			t.Error("expected user id in context")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := auth.Middleware(next)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenStr))

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}
	if !nextCalled {
		t.Error("expected next handler to be called")
	}
}

func TestOpenSyberAuth_Middleware_MissingAuth(t *testing.T) {
	auth := &OpenSyberAuth{}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	handler := auth.Middleware(next)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", rr.Code)
	}
}

// encodeBase64URL encodes bytes to base64url.
func encodeBase64URL(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}
