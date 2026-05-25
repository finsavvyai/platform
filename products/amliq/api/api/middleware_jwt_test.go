package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestJWTMiddleware(t *testing.T) {
	secret := "test-secret-key-12345"
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	middleware := JWTMiddleware(secret)
	handler := middleware(next)

	tests := []struct {
		name       string
		token      string
		wantStatus int
	}{
		{
			name:       "valid token",
			token:      makeTestToken(secret, "tnt_test000001", "usr_1", "admin", time.Now().Add(1*time.Hour).Unix()),
			wantStatus: http.StatusOK,
		},
		{
			name:       "expired token",
			token:      makeTestToken(secret, "tnt_test000001", "usr_1", "admin", time.Now().Add(-1*time.Hour).Unix()),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bad signature",
			token:      makeTestToken("wrong", "tnt_test000001", "usr_1", "admin", time.Now().Add(1*time.Hour).Unix()),
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.Header.Set("Authorization", "Bearer "+tt.token)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			if w.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestJWTExtractsClaims(t *testing.T) {
	secret := "test-secret"
	tenantID := "tnt_abc123def456"
	userID := "usr_xyz"
	role := "analyst"
	exp := time.Now().Add(1 * time.Hour).Unix()

	token := makeTestToken(secret, tenantID, userID, role, exp)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			t.Fatal("claims not in context")
		}
		if claims.TenantID != tenantID {
			t.Errorf("tenantID: got %s, want %s", claims.TenantID, tenantID)
		}
		if claims.UserID != userID {
			t.Errorf("userID: got %s, want %s", claims.UserID, userID)
		}
		if claims.Role != role {
			t.Errorf("role: got %s, want %s", claims.Role, role)
		}
		w.WriteHeader(http.StatusOK)
	})

	middleware := JWTMiddleware(secret)
	handler := middleware(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("got %d, want 200", w.Code)
	}
}
