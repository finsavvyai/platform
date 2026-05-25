package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeEntity(id, name, listID string) domain.Entity {
	eid, _ := domain.NewEntityID(id)
	n, _ := domain.NewName(name, "", "", "")
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
	e.ListID = listID
	return e
}

func TestSearchIndex(t *testing.T) {
	entities := []domain.Entity{
		makeEntity("ent_000000000001", "Vladimir Putin", "OFAC"),
		makeEntity("ent_000000000002", "Muhammad Ali", "UN"),
		makeEntity("ent_000000000003", "Mohammad Ali Khan", "EU"),
		makeEntity("ent_000000000004", "Kim Jong Un", "OFAC"),
	}

	tests := []struct {
		name      string
		query     string
		opts      SearchOpts
		wantMin   int
		wantEmpty bool
		checkFn   func([]Candidate) bool
	}{
		{
			name:    "exact_match",
			query:   "Vladimir Putin",
			opts:    SearchOpts{Limit: 10},
			wantMin: 1,
			checkFn: func(c []Candidate) bool {
				return c[0].Entity.ID.String() == "ent_000000000001"
			},
		},
		{
			name:    "phonetic_mohammad_muhammad",
			query:   "Mohammad Ali",
			opts:    SearchOpts{Limit: 10},
			wantMin: 1,
		},
		{
			name:    "token_lookup",
			query:   "Ali Khan",
			opts:    SearchOpts{Limit: 10},
			wantMin: 1,
		},
		{
			name:    "trigram_fuzzy",
			query:   "Vladmir Putn",
			opts:    SearchOpts{Limit: 10},
			wantMin: 1,
		},
		{
			name:    "filter_by_list",
			query:   "Vladimir Putin",
			opts:    SearchOpts{Lists: []string{"UN"}, Limit: 10},
			wantMin: 0,
		},
		{
			name:      "empty_index_returns_nothing",
			query:     "Nobody Here",
			opts:      SearchOpts{Limit: 10},
			wantEmpty: true,
		},
	}

	idx := NewSearchIndex()
	idx.Load(entities)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := idx.Search(tt.query, tt.opts)
			if tt.wantEmpty && len(results) > 0 {
				t.Errorf("expected empty, got %d results", len(results))
				return
			}
			if !tt.wantEmpty && len(results) < tt.wantMin {
				t.Errorf("want >= %d results, got %d", tt.wantMin, len(results))
			}
			if tt.checkFn != nil && len(results) > 0 && !tt.checkFn(results) {
				t.Errorf("checkFn failed for %v", results)
			}
		})
	}

	stats := idx.Stats()
	if stats.EntityCount != 4 {
		t.Errorf("entity count = %d, want 4", stats.EntityCount)
	}
}
