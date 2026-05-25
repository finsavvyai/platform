package storage

import (
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type EntityRepository interface {
	Create(entity domain.Entity) error
	GetByID(id domain.EntityID) (*domain.Entity, error)
	Search(query string) ([]domain.Entity, error)
	ListAll() ([]domain.Entity, error)
	ListByLists(listIDs []string) ([]domain.Entity, error)
	ListUpdatedSince(since time.Time) ([]domain.Entity, error)
	Delete(id domain.EntityID) error
}

type InMemoryEntityRepo struct {
	entities map[string]domain.Entity
}

func NewInMemoryEntityRepo() *InMemoryEntityRepo {
	return &InMemoryEntityRepo{
		entities: make(map[string]domain.Entity),
	}
}

func (r *InMemoryEntityRepo) Create(entity domain.Entity) error {
	r.entities[entity.ID.String()] = entity
	return nil
}

func (r *InMemoryEntityRepo) GetByID(id domain.EntityID) (*domain.Entity, error) {
	ent, exists := r.entities[id.String()]
	if !exists {
		return nil, nil
	}
	return &ent, nil
}

func (r *InMemoryEntityRepo) Search(query string) ([]domain.Entity, error) {
	var results []domain.Entity
	for _, ent := range r.entities {
		if ent.PrimaryName().Full == query {
			results = append(results, ent)
		}
	}
	return results, nil
}

func (r *InMemoryEntityRepo) ListAll() ([]domain.Entity, error) {
	results := make([]domain.Entity, 0, len(r.entities))
	for _, ent := range r.entities {
		results = append(results, ent)
	}
	return results, nil
}

func (r *InMemoryEntityRepo) ListByLists(listIDs []string) ([]domain.Entity, error) {
	ids := make(map[string]bool, len(listIDs))
	for _, id := range listIDs {
		ids[id] = true
	}
	var results []domain.Entity
	for _, ent := range r.entities {
		if ids[ent.ListID] {
			results = append(results, ent)
		}
	}
	return results, nil
}

func (r *InMemoryEntityRepo) ListUpdatedSince(since time.Time) ([]domain.Entity, error) {
	var results []domain.Entity
	for _, ent := range r.entities {
		if ent.UpdatedAt.After(since) || ent.UpdatedAt.Equal(since) {
			results = append(results, ent)
		}
	}
	return results, nil
}

func (r *InMemoryEntityRepo) Delete(id domain.EntityID) error {
	delete(r.entities, id.String())
	return nil
}
