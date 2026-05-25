package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddleware(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	middleware := AuthMiddleware(handler)

	tests := []struct {
		name           string
		header         string
		value          string
		expectedStatus int
	}{
		{
			name:           "valid_bearer",
			header:         "Authorization",
			value:          "Bearer valid_token",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "valid_apikey",
			header:         "X-API-Key",
			value:          "valid_key",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "missing_auth",
			header:         "",
			value:          "",
			expectedStatus: http.StatusUnauthorized,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/", nil)
			if tt.header != "" {
				r.Header.Set(tt.header, tt.value)
			}
			middleware.ServeHTTP(w, r)
			if w.Code != tt.expectedStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.expectedStatus)
			}
		})
	}
}
