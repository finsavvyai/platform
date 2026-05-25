package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestAuditHandler(t *testing.T) {
	audit := storage.NewInMemoryAuditRepo()
	handler := NewAuditHandler(audit)

	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	entry, _ := domain.NewAuditEntry(
		tenantID,
		domain.AuditActionScreeningPerformed,
		"user_123",
		"ScreenRequest",
		"req_456",
	)
	audit.Create(entry)

	tests := []struct {
		name           string
		method         string
		path           string
		pathID         string
		tenantID       string
		isGet          bool
		expectedStatus int
	}{
		{
			name:           "list_audit_success",
			method:         http.MethodGet,
			path:           "/api/v1/audit",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "list_audit_no_tenant",
			method:         http.MethodGet,
			path:           "/api/v1/audit",
			tenantID:       "",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "get_audit_entry_success",
			method:         http.MethodGet,
			path:           "/api/v1/audit/" + entry.ID,
			pathID:         entry.ID,
			tenantID:       "tnt_000000000001",
			isGet:          true,
			expectedStatus: http.StatusOK,
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
				ctx = ContextWithClaims(ctx, &Claims{
					TenantID: tt.tenantID, UserID: "usr_test",
				})
				r = r.WithContext(ctx)
			}

			if tt.isGet {
				handler.GetAuditEntry(w, r)
			} else {
				handler.ListAuditTrail(w, r)
			}

			if w.Code != tt.expectedStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.expectedStatus)
			}
		})
	}
}
