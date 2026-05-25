package ingestion

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// Compile-time check: stubEntityStore must satisfy both the plain and
// the streaming store interfaces so sync_service can pick the stream
// path in tests.
var _ StreamingEntityStore = (*stubEntityStore)(nil)

// IDsByListID echoes the current set of prior IDs for streaming sync.
func (s *stubEntityStore) IDsByListID(
	_ context.Context, _ domain.TenantID, _ string,
) ([]string, error) {
	out := make([]string, 0, len(s.entities))
	for _, e := range s.entities {
		out = append(out, e.ID.String())
	}
	return out, nil
}

// GetByIDs returns any stub entities whose IDs appear in the query set.
func (s *stubEntityStore) GetByIDs(
	_ context.Context, _ domain.TenantID, ids []string,
) ([]domain.Entity, error) {
	want := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		want[id] = struct{}{}
	}
	var out []domain.Entity
	for _, e := range s.entities {
		if _, ok := want[e.ID.String()]; ok {
			out = append(out, e)
		}
	}
	return out, nil
}

// SoftDeleteByIDs records retired IDs on the stub's deleted slice so
// assertions can inspect them without loading an Entity round-trip.
func (s *stubEntityStore) SoftDeleteByIDs(
	_ context.Context, _ domain.TenantID, ids []string,
) error {
	for _, id := range ids {
		eid, err := domain.NewEntityID(id)
		if err != nil {
			continue
		}
		s.deleted = append(s.deleted, domain.Entity{ID: eid})
	}
	return nil
}
