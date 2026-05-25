package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func testClaims() *Claims {
	return &Claims{
		TenantID: "tnt_000000000001",
		UserID:   "usr_test",
		Role:     "admin",
		Exp:      time.Now().Add(time.Hour).Unix(),
		Iat:      time.Now().Unix(),
	}
}

func TestAlertHandler_GetAlert(t *testing.T) {
	tests := []struct {
		name       string
		alertID    string
		setupRepos func(*storage.InMemoryAlertRepo)
		expect     int
	}{
		{name: "missing_id", alertID: "", expect: http.StatusBadRequest},
		{name: "not_found", alertID: "alr_notfound", expect: http.StatusNotFound},
		{
			name:    "success",
			alertID: "alr_123456789012",
			setupRepos: func(ar *storage.InMemoryAlertRepo) {
				tid, _ := domain.NewTenantID("tnt_000000000001")
				alert, _ := domain.NewAlert(tid, "scr_1", testMatch())
				alert.ID = "alr_123456789012"
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
			req := httptest.NewRequest(http.MethodGet,
				"/api/v1/alerts/"+tt.alertID, nil)
			req.SetPathValue("id", tt.alertID)
			ctx := ContextWithClaims(req.Context(), testClaims())
			req = req.WithContext(ctx)
			w := httptest.NewRecorder()
			h.GetAlert(w, req)
			if w.Code != tt.expect {
				t.Errorf("got %d, want %d", w.Code, tt.expect)
			}
		})
	}
}
