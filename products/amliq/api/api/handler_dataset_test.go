package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestHandleDatasetLatest(t *testing.T) {
	repo := storage.NewInMemoryEntityRepo()
	dh := NewDatasetHandler(repo)
	tests := []struct {
		name        string
		tenantID    string
		format      string
		wantStatus  int
		wantCTMatch string
	}{
		{"csv with tenant", "tnt_abcdefghijkl", "csv", 200, "text/csv"},
		{"json with tenant", "tnt_abcdefghijkl", "json", 200, "application/json"},
		{"default format", "tnt_abcdefghijkl", "", 200, "text/csv"},
		{"no tenant", "", "csv", 401, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/v1/dataset/latest"
			if tt.format != "" {
				url += "?format=" + tt.format
			}
			req := newTenantRequest("GET", url, tt.tenantID)
			rr := httptest.NewRecorder()
			dh.Latest(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantStatus == 200 {
				ct := rr.Header().Get("Content-Type")
				if !strings.Contains(ct, tt.wantCTMatch) {
					t.Errorf("content-type = %s, want %s", ct, tt.wantCTMatch)
				}
			}
		})
	}
}

func TestHandleDatasetDelta(t *testing.T) {
	repo := storage.NewInMemoryEntityRepo()
	dd := NewDatasetDeltaHandler(repo)
	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"with tenant", "tnt_abcdefghijkl", 200},
		{"no tenant", "", 401},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/dataset/delta", tt.tenantID)
			rr := httptest.NewRecorder()
			dd.Delta(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantStatus == http.StatusOK {
				var result map[string]interface{}
				json.NewDecoder(rr.Body).Decode(&result)
				data, _ := result["data"].(map[string]interface{})
				if data == nil {
					t.Fatal("response missing data envelope")
				}
				if _, ok := data["added"]; !ok {
					t.Error("response missing added")
				}
			}
		})
	}
}

func TestDatasetCSVHeaders(t *testing.T) {
	repo := storage.NewInMemoryEntityRepo()
	n, _ := domain.NewName("Test Entity", "", "", "")
	eid, _ := domain.NewEntityID("test_id")
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
	repo.Create(e)

	dh := NewDatasetHandler(repo)
	req := newTenantRequest("GET", "/api/v1/dataset/latest?format=csv", "tnt_1")
	rr := httptest.NewRecorder()
	dh.Latest(rr, req)

	body := rr.Body.String()
	lines := strings.Split(strings.TrimSpace(body), "\n")
	headers := strings.Split(lines[0], ",")

	expected := []string{"entity_id", "primary_name", "aliases", "type", "dob"}
	for _, h := range expected {
		found := false
		for _, col := range headers {
			if strings.TrimSpace(col) == h {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing header: %s", h)
		}
	}
}

func TestDatasetDeltaListUpdatedSince(t *testing.T) {
	repo := storage.NewInMemoryEntityRepo()
	dd := NewDatasetDeltaHandler(repo)

	since := time.Now().AddDate(0, 0, -1).Format(time.RFC3339)
	req := newTenantRequest("GET", "/api/v1/dataset/delta?since="+since, "tnt_1")
	rr := httptest.NewRecorder()
	dd.Delta(rr, req)

	if rr.Code != 200 {
		t.Errorf("status = %d, want 200", rr.Code)
	}
}
