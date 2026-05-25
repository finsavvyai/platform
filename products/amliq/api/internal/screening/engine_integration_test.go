package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestScreenWithContext(t *testing.T) {
	engine := NewEngine(nil)
	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	query := makeTestEntity(t, "ent_000000000001", "John Smith")
	cand := makeTestEntity(t, "ent_000000000002", "John Smith")
	cand.ListID = "ofac_sdn"

	tests := []struct {
		name      string
		matchCfg  *domain.MatchConfig
		wantMatch bool
	}{
		{"nil_config_matches", nil, true},
		{"all_enabled_matches", matchCfgAllEnabled(tenantID), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := engine.ScreenWithContext(
				context.Background(), tenantID, query, []domain.Entity{cand}, tt.matchCfg,
			)
			if err != nil {
				t.Fatalf("ScreenWithContext error: %v", err)
			}
			if got := len(results) > 0; got != tt.wantMatch {
				t.Errorf("got match=%v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestEmbeddingLayerDisabledByConfig(t *testing.T) {
	engine := NewEngine(nil)
	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	query := makeTestEntity(t, "ent_000000000001", "Muhammad al-Rahman")
	cand := makeTestEntity(t, "ent_000000000002", "Completely Different Name")
	cand.ListID = "ofac_sdn"

	cfg := matchCfgAllEnabled(tenantID)
	cfg.EmbeddingEnabled = false

	results, err := engine.ScreenWithContext(
		context.Background(), tenantID, query, []domain.Entity{cand}, cfg,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, r := range results {
		for _, ev := range r.Evidence {
			if ev.Layer == domain.MatchLayerEmbedding {
				t.Error("embedding evidence found despite EmbeddingEnabled=false")
			}
		}
	}
}

func TestGraphLayerDisabledByDefault(t *testing.T) {
	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	cfg := domain.DefaultMatchConfig(tenantID)
	if cfg.GraphEnabled {
		t.Fatal("expected GraphEnabled=false by default")
	}
	if !cfg.EmbeddingEnabled {
		t.Fatal("expected EmbeddingEnabled=true by default")
	}
}

func makeTestEntity(t *testing.T, id, fullName string) domain.Entity {
	t.Helper()
	eid, err := domain.NewEntityID(id)
	if err != nil {
		t.Fatalf("NewEntityID: %v", err)
	}
	name, err := domain.NewName(fullName, "", "", "")
	if err != nil {
		t.Fatalf("NewName: %v", err)
	}
	ent, err := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{name})
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	return ent
}

func matchCfgAllEnabled(tid domain.TenantID) *domain.MatchConfig {
	cfg := domain.DefaultMatchConfig(tid)
	return &cfg
}

func matchCfgExactOnly(tid domain.TenantID) *domain.MatchConfig {
	cfg := domain.DefaultMatchConfig(tid)
	cfg.FuzzyEnabled = false
	cfg.PhoneticEnabled = false
	cfg.TokenEnabled = false
	cfg.EmbeddingEnabled = false
	cfg.GraphEnabled = false
	return &cfg
}
