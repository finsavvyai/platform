package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type Delta struct {
	Added    []domain.Entity
	Removed  []domain.Entity
	Modified []domain.Entity
}

type DeltaEngine struct{}

func NewDeltaEngine() *DeltaEngine {
	return &DeltaEngine{}
}

func (de *DeltaEngine) Diff(
	previous []domain.Entity,
	current []domain.Entity,
) Delta {
	prevMap := de.toMap(previous)
	currMap := de.toMap(current)

	delta := Delta{
		Added:    []domain.Entity{},
		Removed:  []domain.Entity{},
		Modified: []domain.Entity{},
	}

	for id, curr := range currMap {
		if prev, exists := prevMap[id]; !exists {
			delta.Added = append(delta.Added, curr)
		} else if prev.UpdatedAt != curr.UpdatedAt {
			delta.Modified = append(delta.Modified, curr)
		}
	}

	for id, prev := range prevMap {
		if _, exists := currMap[id]; !exists {
			delta.Removed = append(delta.Removed, prev)
		}
	}

	return delta
}

func (de *DeltaEngine) toMap(entities []domain.Entity) map[string]domain.Entity {
	m := make(map[string]domain.Entity)
	for _, e := range entities {
		m[e.ID.String()] = e
	}
	return m
}
