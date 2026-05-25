package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type PEPRepository interface {
	Create(ctx context.Context, profile domain.PEPProfile) error
	GetByEntityID(ctx context.Context, entityID string) (*domain.PEPProfile, error)
	ListByCountry(ctx context.Context, country string, limit int) ([]domain.PEPProfile, error)
	SearchByName(ctx context.Context, query string, limit int) ([]PEPSearchResult, error)
}

// PEPSearchResult joins PEP profile data with the entity name.
type PEPSearchResult struct {
	EntityID string `json:"entity_id"`
	Name     string `json:"name"`
	Position string `json:"position"`
	Country  string `json:"country"`
	Tier     int    `json:"tier"`
	IsActive bool   `json:"is_active"`
}
