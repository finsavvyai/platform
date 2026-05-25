package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestConfigHandler(t *testing.T) {
	tenants := storage.NewInMemoryTenantRepo()
	audit := storage.NewInMemoryAuditRepo()
	handler := NewConfigHandler(tenants, audit)

	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	tenant, _ := domain.NewTenant(tenantID, "acme", "ACME Corp")
	tenants.Create(tenant)

	tests := []struct {
		name           string
		method         string
		path           string
		tenantID       string
		body           map[string]interface{}
		expectedStatus int
	}{
		{
			name:           "get_config_success",
			method:         http.MethodGet,
			path:           "/api/v1/config",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "get_config_no_tenant",
			method:         http.MethodGet,
			path:           "/api/v1/config",
			tenantID:       "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "update_config_success",
			method:   http.MethodPut,
			path:     "/api/v1/config",
			tenantID: "tnt_000000000001",
			body: map[string]interface{}{
				"default_threshold": 0.75,
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:     "update_config_invalid_weights",
			method:   http.MethodPut,
			path:     "/api/v1/config",
			tenantID: "tnt_000000000001",
			body: map[string]interface{}{
				"default_threshold": 150.0,
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			var r *http.Request
			if tt.body != nil {
				body, _ := json.Marshal(tt.body)
				r = httptest.NewRequest(tt.method, tt.path, bytes.NewReader(body))
			} else {
				r = httptest.NewRequest(tt.method, tt.path, nil)
			}
			if tt.tenantID != "" {
				ctx := context.WithValue(r.Context(), TenantContextKey, tt.tenantID)
				r = r.WithContext(ctx)
			}

			if tt.method == http.MethodGet {
				handler.GetConfig(w, r)
			} else {
				handler.UpdateConfig(w, r)
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.expectedStatus)
			}
		})
	}
}
