package screening

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func buildTestEntities() []domain.Entity {
	eid1, _ := domain.NewEntityID("ent_000000000001")
	n1, _ := domain.NewName("Osama Bin Laden", "", "", "")
	eid2, _ := domain.NewEntityID("ent_000000000002")
	n2, _ := domain.NewName("Saddam Hussein", "", "", "")
	return []domain.Entity{
		{ID: eid1, Names: []domain.Name{n1}, ListID: "ofac-sdn"},
		{ID: eid2, Names: []domain.Name{n2}, ListID: "un-consolidated"},
	}
}

func TestBloomRejectsUnknown(t *testing.T) {
	tests := []struct {
		name    string
		query   string
		wantNil bool
	}{
		{"unknown name cleared by bloom", "John Nobody Smith", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bf := NewBloom(1000, 0.001)
			bf.Add("osama bin laden")
			ti := &TieredIndex{
				bloom:      bf,
				hotCache:   NewSearchIndex(),
				queryCache: NewLRUCache(100, time.Minute),
			}
			results := ti.Search(tt.query, SearchOpts{})
			if tt.wantNil && len(results) != 0 {
				t.Errorf("expected nil results, got %d", len(results))
			}
		})
	}
}

func TestHotCacheReturnsOFAC(t *testing.T) {
	entities := buildTestEntities()
	bf := NewBloom(1000, 0.001)
	for _, e := range entities {
		bf.Add(e.Names[0].Full)
	}
	ti := NewTieredIndex(bf, entities, nil)

	results := ti.Search("Osama Bin Laden", SearchOpts{Limit: 10})
	if len(results) == 0 {
		t.Fatal("expected hot cache hit for OFAC name")
	}
}

func TestLRUCachePreventsRepeat(t *testing.T) {
	entities := buildTestEntities()
	bf := NewBloom(1000, 0.001)
	for _, e := range entities {
		bf.Add(e.Names[0].Full)
	}
	ti := NewTieredIndex(bf, entities, nil)

	// First search populates cache
	ti.Search("Osama Bin Laden", SearchOpts{Limit: 10})
	// Second search hits LRU
	results := ti.Search("Osama Bin Laden", SearchOpts{Limit: 10})
	if len(results) == 0 {
		t.Fatal("expected LRU cache hit")
	}
}

func TestTieredFallbackOrder(t *testing.T) {
	bf := NewBloom(1000, 0.001)
	bf.Add("test person")
	// No hot entities, no DB — should return nil after bloom passes
	ti := &TieredIndex{
		bloom:      bf,
		hotCache:   NewSearchIndex(),
		pgSearcher: &PGSearcher{db: nil},
		queryCache: NewLRUCache(100, time.Minute),
	}
	results := ti.Search("test person", SearchOpts{})
	if len(results) != 0 {
		t.Errorf("expected no results without hot/DB, got %d", len(results))
	}
}
