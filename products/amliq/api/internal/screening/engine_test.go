package screening

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEngine(t *testing.T) {
	engine := NewEngine(nil)
	tenantID, _ := domain.NewTenantID("tnt_000000000001")
	queryID, _ := domain.NewEntityID("ent_000000000001")
	candID, _ := domain.NewEntityID("ent_000000000002")

	queryName, _ := domain.NewName("John Smith", "John", "Smith", "")
	candName, _ := domain.NewName("John Smith", "John", "Smith", "")

	queryEnt, _ := domain.NewEntity(queryID, domain.EntityTypeIndividual, []domain.Name{queryName})
	candEnt, _ := domain.NewEntity(candID, domain.EntityTypeIndividual, []domain.Name{candName})
	candEnt.ListID = "list_001"

	screenReq, _ := domain.NewScreenRequest(tenantID, queryEnt)
	_ = screenReq

	tests := []struct {
		name              string
		query             domain.Entity
		candidates        []domain.Entity
		shouldHaveMatches bool
	}{
		{
			name:              "exact_match",
			query:             queryEnt,
			candidates:        []domain.Entity{candEnt},
			shouldHaveMatches: true,
		},
		{
			name:              "no_candidates",
			query:             queryEnt,
			candidates:        []domain.Entity{},
			shouldHaveMatches: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := engine.Screen(tt.query, tt.candidates)
			if err != nil {
				t.Fatalf("Screen() error = %v", err)
			}
			hasMatches := len(results) > 0
			if hasMatches != tt.shouldHaveMatches {
				t.Errorf("Screen() hasMatches = %v, want %v", hasMatches, tt.shouldHaveMatches)
			}
		})
	}
}
