package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	tests := []struct {
		name       string
		handler    http.HandlerFunc
		wantStatus int
		wantKey    string
	}{
		{
			name: "health returns status",
			handler: func(w http.ResponseWriter, r *http.Request) {
				Success(w, map[string]interface{}{
					"status":  "healthy",
					"version": "2.0.0",
				}, http.StatusOK)
			},
			wantStatus: http.StatusOK,
			wantKey:    "status",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			rr := httptest.NewRecorder()
			tt.handler(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			var body map[string]interface{}
			json.NewDecoder(rr.Body).Decode(&body)
			data, ok := body["data"].(map[string]interface{})
			if !ok {
				t.Fatal("missing data field")
			}
			if _, exists := data[tt.wantKey]; !exists {
				t.Errorf("missing key %q in response", tt.wantKey)
			}
		})
	}
}
