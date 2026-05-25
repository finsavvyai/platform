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

func TestAlertHandler_ResolveAlert(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		alertID    string
		body       interface{}
		setupCtx   func() context.Context
		setupRepos func(*storage.InMemoryAlertRepo)
		expect     int
	}{
		{
			name: "invalid_method", method: http.MethodGet, alertID: "alr_1",
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expect: http.StatusMethodNotAllowed,
		},
		{
			name: "missing_claims", method: http.MethodPut, alertID: "alr_1",
			setupCtx: func() context.Context { return context.Background() },
			expect:   http.StatusUnauthorized,
		},
		{
			name: "missing_id", method: http.MethodPut, alertID: "",
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expect: http.StatusBadRequest,
		},
		{
			name: "not_found", method: http.MethodPut, alertID: "alr_notfound",
			body: ResolveAlertRequest{Justification: "fp"},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expect: http.StatusNotFound,
		},
		{
			name: "success", method: http.MethodPut, alertID: "alr_resolve01",
			body: ResolveAlertRequest{Justification: "false positive"},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			setupRepos: func(ar *storage.InMemoryAlertRepo) {
				tid, _ := domain.NewTenantID("tnt_000000000001")
				a, _ := domain.NewAlert(tid, "scr_1", testMatch())
				a.ID = "alr_resolve01"
				ar.Create(a)
			},
			expect: http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			alerts := storage.NewInMemoryAlertRepo()
			if tt.setupRepos != nil {
				tt.setupRepos(alerts)
			}
			h := NewAlertHandler(alerts, storage.NewInMemoryAuditRepo())
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(tt.method, "/api/v1/alerts/"+tt.alertID,
				bytes.NewReader(body))
			req.SetPathValue("id", tt.alertID)
			req = req.WithContext(tt.setupCtx())
			w := httptest.NewRecorder()
			h.ResolveAlert(w, req)
			if w.Code != tt.expect {
				t.Errorf("got %d, want %d", w.Code, tt.expect)
			}
		})
	}
}
