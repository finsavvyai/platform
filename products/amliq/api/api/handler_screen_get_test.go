package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestScreenHandler_GetScreening(t *testing.T) {
	tests := []struct {
		name         string
		screeningID  string
		setupRepos   func(*storage.InMemoryScreeningRepo)
		expectStatus int
	}{
		{
			name:         "missing_id",
			screeningID:  "",
			expectStatus: http.StatusBadRequest,
		},
		{
			name:         "screening_not_found",
			screeningID:  "res_notfound",
			expectStatus: http.StatusNotFound,
		},
		{
			name:        "successful_get",
			screeningID: "res_123456789012",
			setupRepos: func(sr *storage.InMemoryScreeningRepo) {
				tid, _ := domain.NewTenantID("tnt_000000000001")
				req, _ := domain.NewScreenRequest(tid, mustEntity("ent_000000000001"))
				resp := domain.NewScreenResponse(req)
				resp.ID = "res_123456789012"
				sr.Create(resp)
			},
			expectStatus: http.StatusOK,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			screenings := storage.NewInMemoryScreeningRepo()
			if tt.setupRepos != nil {
				tt.setupRepos(screenings)
			}
			handler := NewScreenHandler(
				storage.NewInMemoryEntityRepo(), screenings,
				storage.NewInMemoryAlertRepo(), storage.NewInMemoryAuditRepo(),
				storage.NewInMemoryTenantRepo(), screening.NewEngine(nil),
			)
			req := httptest.NewRequest(http.MethodGet,
				"/api/v1/screen/"+tt.screeningID, nil)
			req.SetPathValue("id", tt.screeningID)
			ctx := ContextWithClaims(req.Context(), testClaims())
			req = req.WithContext(ctx)
			w := httptest.NewRecorder()
			handler.GetScreening(w, req)
			if w.Code != tt.expectStatus {
				t.Errorf("status: got %d, want %d", w.Code, tt.expectStatus)
			}
		})
	}
}

func mustEntity(idStr string) domain.Entity {
	id, _ := domain.NewEntityID(idStr)
	name, _ := domain.NewName("Test Entity", "", "", "")
	ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
	return ent
}
