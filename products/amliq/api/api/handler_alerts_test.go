package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestAlertHandler_ListAlerts(t *testing.T) {
	tests := []struct {
		name       string
		setupCtx   func() context.Context
		setupRepos func(*storage.InMemoryAlertRepo)
		expect     int
	}{
		{
			name:     "missing_claims",
			setupCtx: func() context.Context { return context.Background() },
			expect:   http.StatusUnauthorized,
		},
		{
			name: "list_all",
			setupCtx: func() context.Context {
				return ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_000000000001", UserID: "u1"})
			},
			setupRepos: func(ar *storage.InMemoryAlertRepo) {
				tid, _ := domain.NewTenantID("tnt_000000000001")
				alert, _ := domain.NewAlert(tid, "scr_1", testMatch())
				ar.Create(alert)
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
			req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts", nil)
			req = req.WithContext(tt.setupCtx())
			w := httptest.NewRecorder()
			h.ListAlerts(w, req)
			if w.Code != tt.expect {
				t.Errorf("got %d, want %d", w.Code, tt.expect)
			}
		})
	}
}

func testMatch() domain.MatchResult {
	eid, _ := domain.NewEntityID("ent_000000000002")
	conf, _ := domain.NewConfidence(0.85)
	return domain.NewMatchResult(eid, conf, domain.DispositionReview,
		[]domain.MatchEvidence{}, "test", "list_test")
}
