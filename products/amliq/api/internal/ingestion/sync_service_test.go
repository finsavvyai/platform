package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestSyncServiceSyncList(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("123456789012|John Smith|individual|SDGT\n"))
	}))
	defer ts.Close()

	tests := []struct {
		name    string
		listCfg domain.ListConfig
		wantErr bool
	}{
		{
			name:    "empty_url",
			listCfg: domain.ListConfig{ListID: "ofac", ParserType: "ofac"},
			wantErr: true,
		},
		{
			name: "valid_list",
			listCfg: domain.ListConfig{
				ListID:     "ofac",
				SourceURL:  ts.URL + "/ofac.csv",
				ParserType: "ofac",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fetcher := NewListFetcher(5 * time.Second)
			registry := NewRegistry()
			registry.Register(domain.ListSourceOFAC, NewOFACParser())
			delta := NewDeltaEngine()
			store := &stubEntityStore{}
			meta := &stubMetaStore{}

			svc := NewSyncService(fetcher, registry, delta, store, meta)
			tenantID, _ := domain.NewTenantID("tnt_test12345678")

			ctx := context.Background()
			err := svc.SyncList(ctx, tenantID, tt.listCfg)
			if (err != nil) != tt.wantErr {
				t.Errorf("SyncList() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
