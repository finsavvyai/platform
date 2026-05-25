package auth

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"quantumbeam/internal/models"
)

// newSecurityMiddleware returns an AuthMiddleware backed by a mock
// auth service so tests do not need Redis.
func newSecurityMiddleware() (*AuthMiddleware, *MockAuthService) {
	jwtSvc := &JWTService{
		secretKey: []byte("test-secret-key-32-characters-long"),
		issuer:    "quantumbeam-test",
	}
	mockAuth := &MockAuthService{}
	mw := NewAuthMiddleware(jwtSvc, mockAuth, nil)
	return mw, mockAuth
}

func securityRouter(mw *AuthMiddleware) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(mw.JWTAuth())
	r.GET("/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

// --- 8.1: JWT Auth Bypass Tests ---

func TestSecurity_EmptyAuthorizationHeader(t *testing.T) {
	mw, _ := newSecurityMiddleware()
	router := securityRouter(mw)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "MISSING_AUTH_HEADER")
}

func TestSecurity_MalformedBearerToken(t *testing.T) {
	mw, mockAuth := newSecurityMiddleware()

	// Mock: any non-valid token returns error
	mockAuth.On("ValidateAPIKey", mock.Anything, mock.Anything).
		Maybe().Return(nil, fmt.Errorf("invalid"))

	router := securityRouter(mw)

	headers := []struct {
		name   string
		header string
	}{
		{"no space", "Bearertoken"},
		{"wrong scheme", "Basic dXNlcjpwYXNz"},
		{"lowercase bearer", "bearer valid-looking"},
		{"random garbage", "xyzzy"},
	}

	for _, tc := range headers {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			req.Header.Set("Authorization", tc.header)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestSecurity_ExpiredToken_ViaMiddleware(t *testing.T) {
	mw, mockAuth := newSecurityMiddleware()
	router := securityRouter(mw)

	// Build an expired token signed with the correct secret
	secret := []byte("test-secret-key-32-characters-long")
	claims := jwt.MapClaims{
		"user_id": "user-1",
		"email":   "user@example.com",
		"role":    "developer",
		"iat":     time.Now().Add(-2 * time.Hour).Unix(),
		"exp":     time.Now().Add(-1 * time.Hour).Unix(),
		"sub":     "user-1",
		"iss":     "quantumbeam-test",
		"aud":     "quantumbeam-api",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	assert.NoError(t, err)

	// The middleware calls jwtService.AuthenticateJWT which calls
	// ValidateJWT. Since redisClient is nil, this will fail before
	// reaching the blacklist check -- the middleware catches errors
	// and returns 401.
	_ = mockAuth

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_TOKEN")
}

func TestSecurity_TokenSignedWithWrongKey(t *testing.T) {
	mw, _ := newSecurityMiddleware()
	router := securityRouter(mw)

	wrongKey := []byte("completely-different-secret-key!!")
	claims := jwt.MapClaims{
		"user_id": "attacker",
		"email":   "attacker@evil.com",
		"role":    "admin",
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(time.Hour).Unix(),
		"sub":     "attacker",
		"iss":     "quantumbeam-test",
		"aud":     "quantumbeam-api",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(wrongKey)
	assert.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestSecurity_NoneAlgorithmAttack(t *testing.T) {
	mw, _ := newSecurityMiddleware()
	router := securityRouter(mw)

	// Manually craft a token with alg: none (no signature)
	header := base64.RawURLEncoding.EncodeToString(
		mustJSON(map[string]string{"alg": "none", "typ": "JWT"}),
	)
	payload := base64.RawURLEncoding.EncodeToString(
		mustJSON(map[string]interface{}{
			"user_id": "attacker",
			"email":   "attacker@evil.com",
			"role":    "admin",
			"iat":     time.Now().Unix(),
			"exp":     time.Now().Add(time.Hour).Unix(),
			"sub":     "attacker",
			"iss":     "quantumbeam-test",
			"aud":     "quantumbeam-api",
		}),
	)
	noneToken := header + "." + payload + "."

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+noneToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestSecurity_TamperedClaims(t *testing.T) {
	mw, _ := newSecurityMiddleware()
	router := securityRouter(mw)

	secret := []byte("test-secret-key-32-characters-long")
	claims := jwt.MapClaims{
		"user_id": "viewer-1",
		"email":   "viewer@example.com",
		"role":    "viewer",
		"iat":     time.Now().Unix(),
		"exp":     time.Now().Add(time.Hour).Unix(),
		"sub":     "viewer-1",
		"iss":     "quantumbeam-test",
		"aud":     "quantumbeam-api",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	assert.NoError(t, err)

	// Tamper: change role from viewer to admin
	parts := splitJWT(signed)
	assert.Len(t, parts, 3)

	decoded, err := base64.RawURLEncoding.DecodeString(parts[1])
	assert.NoError(t, err)

	var payloadMap map[string]interface{}
	err = json.Unmarshal(decoded, &payloadMap)
	assert.NoError(t, err)
	payloadMap["role"] = "admin"

	tampered := base64.RawURLEncoding.EncodeToString(mustJSON(payloadMap))
	tamperedToken := parts[0] + "." + tampered + "." + parts[2]

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tamperedToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestSecurity_RoleEscalationViaMissingRole(t *testing.T) {
	mw, _ := newSecurityMiddleware()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_role", models.UserRoleViewer)
		c.Next()
	})
	router.Use(mw.RequireRole(models.UserRoleAdmin))
	router.GET("/admin", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), "Insufficient permissions")
}

// --- helpers ---

func mustJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func splitJWT(token string) []string {
	var parts []string
	start := 0
	for i := range token {
		if token[i] == '.' {
			parts = append(parts, token[start:i])
			start = i + 1
		}
	}
	parts = append(parts, token[start:])
	return parts
}
