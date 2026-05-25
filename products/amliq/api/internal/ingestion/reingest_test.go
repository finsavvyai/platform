package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestReingestList(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("123456789012|John Smith|individual|SDGT\n"))
	}))
	defer ts.Close()

	tests := []struct {
		name        string
		listCfg     domain.ListConfig
		dryRun      bool
		wantErr     bool
		wantUpserts int
	}{
		{
			name:    "empty_url",
			listCfg: domain.ListConfig{ListID: "ofac", ParserType: "ofac"},
			wantErr: true,
		},
		{
			name: "dry_run_skips_upsert",
			listCfg: domain.ListConfig{
				ListID:     "ofac",
				SourceURL:  ts.URL + "/ofac.csv",
				ParserType: "ofac",
			},
			dryRun:      true,
			wantErr:     false,
			wantUpserts: 0,
		},
		{
			name: "wet_run_upserts",
			listCfg: domain.ListConfig{
				ListID:     "ofac",
				SourceURL:  ts.URL + "/ofac.csv",
				ParserType: "ofac",
			},
			wantErr:     false,
			wantUpserts: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, store := newTestSyncService(t)
			tid, _ := domain.NewTenantID("tnt_test12345678")
			ctx := context.Background()
			n, err := svc.ReingestList(ctx, tid, tt.listCfg, tt.dryRun)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ReingestList err=%v wantErr=%v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if n == 0 {
				t.Errorf("expected at least one parsed entity")
			}
			if len(store.upserted) != tt.wantUpserts {
				t.Errorf("upserts=%d want=%d", len(store.upserted), tt.wantUpserts)
			}
		})
	}
}

// newTestSyncService returns a SyncService with OFAC registered,
// plus the stub store so tests can assert upserts.
func newTestSyncService(t *testing.T) (*SyncService, *stubEntityStore) {
	t.Helper()
	fetcher := NewListFetcher(5 * time.Second)
	registry := NewRegistry()
	registry.Register(domain.ListSourceOFAC, NewOFACParser())
	delta := NewDeltaEngine()
	store := &stubEntityStore{}
	meta := &stubMetaStore{}
	return NewSyncService(fetcher, registry, delta, store, meta), store
}
