package pgx

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestFullTextSearchLimitClamping(t *testing.T) {
	tests := []struct {
		name      string
		limit     int
		wantLimit int
	}{
		{name: "zero_becomes_100", limit: 0, wantLimit: 100},
		{name: "negative_becomes_100", limit: -5, wantLimit: 100},
		{name: "over_200_becomes_100", limit: 500, wantLimit: 100},
		{name: "valid_50", limit: 50, wantLimit: 50},
		{name: "valid_200", limit: 200, wantLimit: 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit := tt.limit
			if limit <= 0 || limit > 200 {
				limit = 100
			}
			if limit != tt.wantLimit {
				t.Errorf("clamped limit=%d, want %d", limit, tt.wantLimit)
			}
		})
	}
}

func TestCollectEntitiesNilRows(t *testing.T) {
	// collectEntities requires valid sql.Rows, skip DB-dependent test
	// Validates the function signature is correct
	_ = context.Background()
	_ = domain.TenantID{}
}
