package storage

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMockUsageRepositoryGetOrCreate(t *testing.T) {
	repo := NewMockUsageRepository()
	tid := newTestTenantID(t)
	period := "2026-03"

	rec, err := repo.GetOrCreate(context.Background(), tid, domain.ProductAPI, period)
	if err != nil {
		t.Fatalf("GetOrCreate error = %v", err)
	}
	if rec.TenantID != tid.Value() || rec.Period != period {
		t.Errorf("GetOrCreate returned wrong record")
	}
}

func TestMockUsageRepositoryGetOrCreateIdempotent(t *testing.T) {
	repo := NewMockUsageRepository()
	tid := newTestTenantID(t)
	period := "2026-03"

	rec1, _ := repo.GetOrCreate(context.Background(), tid, domain.ProductAPI, period)
	rec2, _ := repo.GetOrCreate(context.Background(), tid, domain.ProductAPI, period)
	if rec1.ID != rec2.ID {
		t.Errorf("not idempotent: %s vs %s", rec1.ID, rec2.ID)
	}
}

func TestMockUsageRepositoryIncrementMetric(t *testing.T) {
	repo := NewMockUsageRepository()
	tid := newTestTenantID(t)
	period := "2026-03"

	err := repo.IncrementMetric(context.Background(), tid, domain.ProductAPI,
		period, domain.MetricAPIScreenings, 100)
	if err != nil {
		t.Errorf("IncrementMetric error = %v", err)
	}
	rec, _ := repo.GetOrCreate(context.Background(), tid, domain.ProductAPI, period)
	if rec.Metrics[domain.MetricAPIScreenings] != 100 {
		t.Errorf("count = %d, want 100", rec.Metrics[domain.MetricAPIScreenings])
	}
}

func TestMockUsageRepositoryIncrementMultiple(t *testing.T) {
	repo := NewMockUsageRepository()
	tid := newTestTenantID(t)
	ctx := context.Background()

	repo.IncrementMetric(ctx, tid, domain.ProductAPI, "2026-03", domain.MetricAPIScreenings, 50)
	repo.IncrementMetric(ctx, tid, domain.ProductAPI, "2026-03", domain.MetricAPIScreenings, 25)

	rec, _ := repo.GetOrCreate(ctx, tid, domain.ProductAPI, "2026-03")
	if rec.Metrics[domain.MetricAPIScreenings] != 75 {
		t.Errorf("count = %d, want 75", rec.Metrics[domain.MetricAPIScreenings])
	}
}

func TestMockUsageRepositoryGetHistory(t *testing.T) {
	repo := NewMockUsageRepository()
	tid := newTestTenantID(t)
	ctx := context.Background()

	repo.GetOrCreate(ctx, tid, domain.ProductAPI, "2026-03")
	repo.GetOrCreate(ctx, tid, domain.ProductAPI, "2026-02")
	repo.GetOrCreate(ctx, tid, domain.ProductAPI, "2026-01")

	recs, err := repo.GetHistory(ctx, tid, domain.ProductAPI, 2)
	if err != nil {
		t.Fatalf("GetHistory error = %v", err)
	}
	if len(recs) != 2 {
		t.Errorf("GetHistory count = %d, want 2", len(recs))
	}
}
