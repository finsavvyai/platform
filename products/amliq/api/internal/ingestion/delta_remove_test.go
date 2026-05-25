package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestDeltaEngineRemoved(t *testing.T) {
	de := NewDeltaEngine()
	name, _ := domain.NewName("Test", "Test", "", "")

	mk := func(idStr string) domain.Entity {
		id, _ := domain.NewEntityID(idStr)
		ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
		return ent
	}

	tests := []struct {
		name          string
		previous      []domain.Entity
		current       []domain.Entity
		expectRemoved int
		expectAdded   int
	}{
		{
			name:          "entity_removed",
			previous:      []domain.Entity{mk("ent_rem000000001"), mk("ent_rem000000002")},
			current:       []domain.Entity{mk("ent_rem000000001")},
			expectRemoved: 1,
			expectAdded:   0,
		},
		{
			name:          "all_removed",
			previous:      []domain.Entity{mk("ent_rem000000003")},
			current:       []domain.Entity{},
			expectRemoved: 1,
			expectAdded:   0,
		},
		{
			name:          "swap",
			previous:      []domain.Entity{mk("ent_rem000000004")},
			current:       []domain.Entity{mk("ent_rem000000005")},
			expectRemoved: 1,
			expectAdded:   1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			delta := de.Diff(tt.previous, tt.current)
			if len(delta.Removed) != tt.expectRemoved {
				t.Errorf("removed=%d, want %d", len(delta.Removed), tt.expectRemoved)
			}
			if len(delta.Added) != tt.expectAdded {
				t.Errorf("added=%d, want %d", len(delta.Added), tt.expectAdded)
			}
		})
	}
}
