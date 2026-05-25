package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestScreenHandler_Screen(t *testing.T) {
	tests := []struct {
		name         string
		method       string
		body         interface{}
		setupCtx     func() context.Context
		setupRepos   func(*storage.InMemoryEntityRepo, *storage.InMemoryTenantRepo)
		expectStatus int
	}{
		{
			name: "invalid_method", method: http.MethodGet,
			body: ScreenRequest{EntityName: "John"},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expectStatus: http.StatusMethodNotAllowed,
		},
		{
			name: "missing_claims", method: http.MethodPost,
			body:         ScreenRequest{EntityName: "John"},
			setupCtx:     func() context.Context { return context.Background() },
			expectStatus: http.StatusUnauthorized,
		},
		{
			name: "missing_name", method: http.MethodPost,
			body: ScreenRequest{EntityName: ""},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expectStatus: http.StatusBadRequest,
		},
		{
			name: "tenant_not_found", method: http.MethodPost,
			body: ScreenRequest{EntityName: "John"},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			expectStatus: http.StatusNotFound,
		},
		{
			name: "success_no_matches", method: http.MethodPost,
			body: ScreenRequest{EntityName: "Unknown Person"},
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			setupRepos: func(e *storage.InMemoryEntityRepo, t *storage.InMemoryTenantRepo) {
				tid, _ := domain.NewTenantID("tnt_000000000001")
				tn, _ := domain.NewTenant(tid, "test", "Test")
				t.Create(tn)
			},
			expectStatus: http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			er := storage.NewInMemoryEntityRepo()
			tr := storage.NewInMemoryTenantRepo()
			if tt.setupRepos != nil {
				tt.setupRepos(er, tr)
			}
			h := NewScreenHandler(er, storage.NewInMemoryScreeningRepo(),
				storage.NewInMemoryAlertRepo(), storage.NewInMemoryAuditRepo(),
				tr, screening.NewEngine(nil))
			body, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(tt.method, "/api/v1/screen",
				bytes.NewReader(body))
			req = req.WithContext(tt.setupCtx())
			w := httptest.NewRecorder()
			h.Screen(w, req)
			if w.Code != tt.expectStatus {
				t.Errorf("got %d, want %d", w.Code, tt.expectStatus)
			}
		})
	}
}
