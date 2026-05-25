package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestDeltaEngine(t *testing.T) {
	de := NewDeltaEngine()
	id1, _ := domain.NewEntityID("ent_000000000001")
	id2, _ := domain.NewEntityID("ent_000000000002")
	name, _ := domain.NewName("John", "John", "", "")

	ent1, _ := domain.NewEntity(id1, domain.EntityTypeIndividual, []domain.Name{name})
	ent2, _ := domain.NewEntity(id2, domain.EntityTypeIndividual, []domain.Name{name})

	tests := []struct {
		name        string
		previous    []domain.Entity
		current     []domain.Entity
		expectAdded int
	}{
		{
			name:        "new_entity",
			previous:    []domain.Entity{},
			current:     []domain.Entity{ent1},
			expectAdded: 1,
		},
		{
			name:        "multiple",
			previous:    []domain.Entity{ent1},
			current:     []domain.Entity{ent1, ent2},
			expectAdded: 1,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			delta := de.Diff(tt.previous, tt.current)
			if len(delta.Added) != tt.expectAdded {
				t.Errorf("Diff() added %d, want %d", len(delta.Added), tt.expectAdded)
			}
		})
	}
}
