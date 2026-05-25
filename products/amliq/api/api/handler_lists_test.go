package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

func TestListsHandler(t *testing.T) {
	tenants := storage.NewInMemoryTenantRepo()
	entities := storage.NewInMemoryEntityRepo()
	handler := NewListsHandler(tenants, entities)

	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	tenant, _ := domain.NewTenant(tenantID, "acme", "ACME Corp")
	tenants.Create(tenant)

	tests := []struct {
		name           string
		method         string
		path           string
		pathID         string
		tenantID       string
		expectedStatus int
	}{
		{
			name:           "list_metadata_success",
			method:         http.MethodGet,
			path:           "/api/v1/lists",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "list_metadata_no_tenant",
			method:         http.MethodGet,
			path:           "/api/v1/lists",
			tenantID:       "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "get_list_metadata_success",
			method:         http.MethodGet,
			path:           "/api/v1/lists/ofac-sdn",
			pathID:         "ofac-sdn",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "get_list_metadata_no_id",
			method:         http.MethodGet,
			path:           "/api/v1/lists/",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.pathID != "" {
				r.SetPathValue("id", tt.pathID)
			}
			if tt.tenantID != "" {
				ctx := context.WithValue(r.Context(), TenantContextKey, tt.tenantID)
				r = r.WithContext(ctx)
			}

			if contains(tt.name, "get_list") {
				handler.GetListMetadata(w, r)
			} else {
				handler.ListMetadata(w, r)
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.expectedStatus)
			}
		})
	}
}
