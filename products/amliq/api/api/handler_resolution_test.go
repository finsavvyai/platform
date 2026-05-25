package api

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubClusterRepo struct {
	clusters []domain.EntityCluster
	err      error
}

func (s *stubClusterRepo) Create(_ context.Context, c domain.EntityCluster) error { return s.err }
func (s *stubClusterRepo) ListByTenant(_ context.Context, _ domain.TenantID) ([]domain.EntityCluster, error) {
	return s.clusters, s.err
}
func (s *stubClusterRepo) UpdateStatus(_ context.Context, id, status string) error { return s.err }

func TestDedupe(t *testing.T) {
	h := NewResolutionHandler(&stubClusterRepo{})
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantMatch  bool
	}{
		{"similar names", `{"names":["MOHAMMED AL RASHID","mohammed al rashid"]}`, 200, true},
		{"different names", `{"names":["John Smith","Jane Doe"]}`, 200, false},
		{"too few names", `{"names":["solo"]}`, 400, false},
		{"bad json", `{bad`, 400, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/resolution/dedupe",
				strings.NewReader(tt.body))
			rr := httptest.NewRecorder()
			h.Dedupe(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantMatch && tt.wantStatus == 200 {
				var body map[string]interface{}
				json.NewDecoder(rr.Body).Decode(&body)
				data := body["data"].(map[string]interface{})
				total := data["total"].(float64)
				if total == 0 {
					t.Error("expected at least 1 match")
				}
			}
		})
	}
}

func TestListClusters(t *testing.T) {
	h := NewResolutionHandler(&stubClusterRepo{clusters: []domain.EntityCluster{}})
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
			req := newTenantRequest("GET", "/api/v1/resolution/clusters", tt.tenantID)
			rr := httptest.NewRecorder()
			h.ListClusters(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
