package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAPIKeyMiddleware(t *testing.T) {
	testKey := "test-api-key-12345"
	testKeyHash := HashAPIKey(testKey)
	validator := &mockAPIKeyValidator{
		keyInfoMap: map[string]*APIKeyInfo{
			testKeyHash:           {TenantID: "tnt_test000001", Product: "api", ExpiresAt: time.Now().Add(24 * time.Hour)},
			HashAPIKey("expired"): {TenantID: "tnt_2", ExpiresAt: time.Now().Add(-1 * time.Hour)},
		},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	middleware := APIKeyMiddleware(validator)
	handler := middleware(next)

	tests := []struct {
		name       string
		headerName string
		headerVal  string
		wantStatus int
	}{
		{"valid X-API-Key", "X-API-Key", testKey, http.StatusOK},
		{"valid ApiKey", "Authorization", "ApiKey " + testKey, http.StatusOK},
		{"missing key", "", "", http.StatusUnauthorized},
		{"expired", "X-API-Key", "expired", http.StatusUnauthorized},
		{"invalid key", "X-API-Key", "bad", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.headerName != "" {
				req.Header.Set(tt.headerName, tt.headerVal)
			}
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestAPIKeyExtractsInfo(t *testing.T) {
	testKey := "test-key-xyz"
	testKeyHash := HashAPIKey(testKey)
	info := &APIKeyInfo{TenantID: "tnt_abc123def456", Product: "sdk", ExpiresAt: time.Now().Add(365 * 24 * time.Hour)}
	validator := &mockAPIKeyValidator{keyInfoMap: map[string]*APIKeyInfo{testKeyHash: info}}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retrieved, ok := APIKeyInfoFromContext(r.Context())
		if !ok {
			t.Fatal("info not in context")
		}
		if retrieved.TenantID != info.TenantID {
			t.Errorf("tenant: got %s, want %s", retrieved.TenantID,
				info.TenantID)
		}
		w.WriteHeader(http.StatusOK)
	})

	middleware := APIKeyMiddleware(validator)
	handler := middleware(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-API-Key", testKey)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("got %d, want 200", w.Code)
	}
}
