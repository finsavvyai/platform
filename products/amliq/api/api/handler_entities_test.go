package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEntitySearchValidation(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		query      string
		wantStatus int
	}{
		{
			name:       "missing_tenant",
			tenantID:   "",
			query:      "test",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing_query",
			tenantID:   "tnt_entsearch_01",
			query:      "",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := &EntitySearchHandler{}
			url := "/api/v1/entities?q=" + tt.query
			r := httptest.NewRequest("GET", url, nil)
			if tt.tenantID != "" {
				ctx := ContextWithClaims(r.Context(),
					&Claims{TenantID: tt.tenantID, UserID: "usr_test"})
				r = r.WithContext(ctx)
			}

			w := httptest.NewRecorder()
			h.Search(w, r)

			if w.Code != tt.wantStatus {
				t.Errorf("Search() status=%d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}
