package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestReingestAll(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("123456789012|Jane Doe|individual|SDGT\n"))
	}))
	defer ts.Close()

	listCfg := domain.ListConfig{
		ListID:      "ofac",
		SourceURL:   ts.URL + "/ofac.csv",
		ParserType:  "ofac",
		SyncEnabled: true,
	}
	tenantA, _ := domain.NewTenantID("tnt_aaaaaaaaaaaa")
	tenantB, _ := domain.NewTenantID("tnt_bbbbbbbbbbbb")
	mk := func(id domain.TenantID, suspended bool) domain.Tenant {
		return domain.Tenant{
			ID:        id,
			Suspended: suspended,
			Config:    domain.TenantConfig{EnabledLists: []domain.ListConfig{listCfg}},
		}
	}

	tests := []struct {
		name        string
		tenants     []domain.Tenant
		opts        ReingestOptions
		wantUpserts int
	}{
		{name: "empty", tenants: nil, wantUpserts: 0},
		{
			name:        "suspended_skipped",
			tenants:     []domain.Tenant{mk(tenantA, true)},
			wantUpserts: 0,
		},
		{
			name:        "all_tenants",
			tenants:     []domain.Tenant{mk(tenantA, false), mk(tenantB, false)},
			wantUpserts: 2,
		},
		{
			name:        "tenant_filter",
			tenants:     []domain.Tenant{mk(tenantA, false), mk(tenantB, false)},
			opts:        ReingestOptions{TenantID: tenantA},
			wantUpserts: 1,
		},
		{
			name:        "list_filter_miss",
			tenants:     []domain.Tenant{mk(tenantA, false)},
			opts:        ReingestOptions{ListID: "nonexistent"},
			wantUpserts: 0,
		},
		{
			name:        "dry_run",
			tenants:     []domain.Tenant{mk(tenantA, false)},
			opts:        ReingestOptions{DryRun: true},
			wantUpserts: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, store := newTestSyncService(t)
			lister := &stubTenantLister{tenants: tt.tenants}
			limiter := NewDownloadLimiter(time.Millisecond)
			rs := NewRefreshService(svc, lister, limiter)
			_, err := rs.ReingestAll(context.Background(), tt.opts)
			if err != nil {
				t.Fatalf("ReingestAll err=%v", err)
			}
			if len(store.upserted) != tt.wantUpserts {
				t.Errorf("upserts=%d want=%d", len(store.upserted), tt.wantUpserts)
			}
		})
	}
}
