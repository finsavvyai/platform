package ingestion

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// stubEntityStore implements EntityStore for tests.
type stubEntityStore struct {
	entities []domain.Entity
	upserted []domain.Entity
	deleted  []domain.Entity
}

func (s *stubEntityStore) ListByListID(
	_ context.Context, _ domain.TenantID, _ string,
) ([]domain.Entity, error) {
	return s.entities, nil
}

func (s *stubEntityStore) BulkUpsert(
	_ context.Context, _ domain.TenantID, ents []domain.Entity,
) error {
	s.upserted = append(s.upserted, ents...)
	return nil
}

func (s *stubEntityStore) SoftDelete(
	_ context.Context, _ domain.TenantID, ents []domain.Entity,
) error {
	s.deleted = append(s.deleted, ents...)
	return nil
}

// stubMetaStore implements ListMetaStore for tests.
type stubMetaStore struct {
	recorded []domain.ListSyncMeta
}

func (s *stubMetaStore) RecordSync(
	_ context.Context, meta domain.ListSyncMeta,
) error {
	s.recorded = append(s.recorded, meta)
	return nil
}

func (s *stubMetaStore) UpdateLastSynced(
	_ context.Context, _ domain.TenantID, _ string, _ time.Time,
) error {
	return nil
}

func (s *stubMetaStore) GetMeta(
	_ context.Context, _ domain.TenantID, _ string,
) (*domain.ListSyncMeta, error) {
	if len(s.recorded) > 0 {
		return &s.recorded[len(s.recorded)-1], nil
	}
	return nil, nil
}
