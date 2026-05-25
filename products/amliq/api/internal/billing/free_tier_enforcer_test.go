package billing

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type fakeUsage struct {
	rec  domain.UsageRecord
	incs int64
}

func (f *fakeUsage) GetOrCreate(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
) (*domain.UsageRecord, error) {
	if f.rec.Metrics == nil {
		f.rec.Metrics = map[domain.UsageMetric]int64{}
	}
	return &f.rec, nil
}

func (f *fakeUsage) IncrementMetric(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ string,
	m domain.UsageMetric, n int64,
) error {
	if f.rec.Metrics == nil {
		f.rec.Metrics = map[domain.UsageMetric]int64{}
	}
	f.rec.Metrics[m] += n
	f.incs += n
	return nil
}

func (f *fakeUsage) GetHistory(
	_ context.Context, _ domain.TenantID,
	_ domain.Product, _ int,
) ([]domain.UsageRecord, error) {
	return nil, nil
}

func newTID(t *testing.T) domain.TenantID {
	t.Helper()
	id, err := domain.NewTenantID("tnt_abcdef012345")
	if err != nil {
		t.Fatalf("tenant id: %v", err)
	}
	return id
}

func TestFreeTierAllowedWithinLimit(t *testing.T) {
	u := &fakeUsage{}
	e := NewEnforcer(nil, u)
	ctx := context.Background()
	tid := newTID(t)
	allowed, rem, err := e.CheckFreeTier(ctx, tid)
	if err != nil || !allowed || rem != FreeTierDailyScreenings {
		t.Fatalf("allowed=%v rem=%d err=%v", allowed, rem, err)
	}
}

func TestFreeTierBlockedAtCap(t *testing.T) {
	u := &fakeUsage{rec: domain.UsageRecord{
		Metrics: map[domain.UsageMetric]int64{
			domain.MetricAPIScreenings: FreeTierDailyScreenings,
		},
	}}
	e := NewEnforcer(nil, u)
	allowed, rem, err := e.CheckFreeTier(context.Background(), newTID(t))
	if err != nil {
		t.Fatalf("err=%v", err)
	}
	if allowed {
		t.Errorf("want blocked at cap, got allowed")
	}
	if rem != 0 {
		t.Errorf("want rem=0, got %d", rem)
	}
}

func TestFreeTierRecordIncrements(t *testing.T) {
	u := &fakeUsage{}
	e := NewEnforcer(nil, u)
	if err := e.RecordFreeTier(context.Background(), newTID(t)); err != nil {
		t.Fatalf("err=%v", err)
	}
	if u.incs != 1 {
		t.Errorf("want 1 inc, got %d", u.incs)
	}
}

func TestFreeTierPeriodIsDaily(t *testing.T) {
	p := freeTierPeriod()
	if len(p) != 10 || p[4] != '-' || p[7] != '-' {
		t.Errorf("want YYYY-MM-DD, got %q", p)
	}
}
