package pgx

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestBulkUpsertEmpty(t *testing.T) {
	tests := []struct {
		name     string
		entities []domain.Entity
		wantErr  bool
	}{
		{
			name:     "nil_entities",
			entities: nil,
			wantErr:  false,
		},
		{
			name:     "empty_slice",
			entities: []domain.Entity{},
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &EntityRepository{}
			ctx := context.Background()
			tid, _ := domain.NewTenantID("tnt_bulk_test_001")

			err := r.BulkUpsert(ctx, tid, tt.entities)
			if (err != nil) != tt.wantErr {
				t.Errorf("BulkUpsert() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}

func TestSoftDeleteEmpty(t *testing.T) {
	tests := []struct {
		name     string
		entities []domain.Entity
		wantErr  bool
	}{
		{
			name:     "nil_entities",
			entities: nil,
			wantErr:  false,
		},
		{
			name:     "empty_slice",
			entities: []domain.Entity{},
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &EntityRepository{}
			ctx := context.Background()
			tid, _ := domain.NewTenantID("tnt_softdel_test1")

			err := r.SoftDelete(ctx, tid, tt.entities)
			if (err != nil) != tt.wantErr {
				t.Errorf("SoftDelete() err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
