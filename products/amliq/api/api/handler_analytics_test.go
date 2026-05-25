package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestAnalyticsHandler(t *testing.T) {
	screenings := storage.NewInMemoryScreeningRepo()
	alerts := storage.NewInMemoryAlertRepo()
	handler := NewAnalyticsHandler(screenings, alerts)

	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	entityID, _ := domain.NewEntityID("ent_000000000001")
	name, _ := domain.NewName("John Doe", "John", "Doe", "")
	entity, _ := domain.NewEntity(entityID, domain.EntityTypeIndividual, []domain.Name{name})
	req, _ := domain.NewScreenRequest(tenantID, entity)
	screenResp := domain.NewScreenResponse(req)
	screenings.Create(screenResp)

	alert, _ := domain.NewAlert(tenantID, screenResp.ID, domain.MatchResult{})
	alerts.Create(alert)

	tests := []struct {
		name           string
		tenantID       string
		expectedStatus int
	}{
		{
			name:           "dashboard_success",
			tenantID:       "tnt_000000000001",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "dashboard_no_tenant",
			tenantID:       "",
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodGet, "/api/v1/analytics", nil)
			if tt.tenantID != "" {
				ctx := context.WithValue(r.Context(), TenantContextKey, tt.tenantID)
				r = r.WithContext(ctx)
			}

			handler.Dashboard(w, r)

			if w.Code != tt.expectedStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.expectedStatus)
			}
		})
	}
}
