package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TestSyncListStreamingEndToEnd drives the full streaming path: the
// HTTP fetch, the row-at-a-time parse, the per-batch BulkUpsert, and
// the final retireUnseen sweep. Seeds the store with one prior entity
// that the CSV does NOT re-emit, then asserts it lands in the deleted
// bucket while the two fresh rows land in upserted.
func TestSyncListStreamingEndToEnd(t *testing.T) {
	csvBody := "id,schema,name,dataset\n" +
		"Q100,Person,Jane Kept,us_ofac_sdn\n" +
		"Q300,Person,John New,us_ofac_sdn\n"
	ts := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("ETag", `"stream-v1"`)
			_, _ = w.Write([]byte(csvBody))
		}))
	defer ts.Close()

	priorID, _ := domain.NewEntityID("ent_oldentity01")
	priorName, _ := domain.NewName("Old Guy", "", "", "")
	prior, _ := domain.NewEntity(
		priorID, domain.EntityTypeIndividual, []domain.Name{priorName},
	)
	prior.ListID = "os_bulk"

	store := &stubEntityStore{entities: []domain.Entity{prior}}
	meta := &stubMetaStore{}
	svc := NewSyncService(
		NewListFetcher(5*time.Second),
		NewRegistry(), NewDeltaEngine(), store, meta,
	)
	tid, _ := domain.NewTenantID("tnt_test12345678")
	cfg := domain.ListConfig{
		ListID:     "os_bulk",
		SourceURL:  ts.URL + "/bulk.csv",
		ParserType: "opensanctions_bulk",
	}

	err := svc.SyncListStreaming(
		context.Background(), tid, cfg,
		NewOpenSanctionsBulkParser(), store,
	)
	if err != nil {
		t.Fatalf("SyncListStreaming: %v", err)
	}

	if len(store.upserted) != 2 {
		t.Errorf("upserted=%d want=2", len(store.upserted))
	}
	if len(store.deleted) != 1 {
		t.Fatalf("deleted=%d want=1", len(store.deleted))
	}
	if got := store.deleted[0].ID.String(); got != priorID.String() {
		t.Errorf("deleted id=%s want=%s", got, priorID.String())
	}
	if len(meta.recorded) != 1 {
		t.Fatalf("meta.recorded=%d want=1", len(meta.recorded))
	}
	if got := meta.recorded[0].EntityCount; got != 2 {
		t.Errorf("EntityCount=%d want=2", got)
	}
}
