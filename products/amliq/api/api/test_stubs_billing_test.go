package api

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type stubSubRepo struct{}

func (s *stubSubRepo) Create(_ context.Context, _ domain.Subscription) error { return nil }
func (s *stubSubRepo) GetByTenantID(_ context.Context, _ domain.TenantID) (*domain.Subscription, error) {
	return &domain.Subscription{}, nil
}
func (s *stubSubRepo) GetByLemonSqueezyID(_ context.Context, _ string) (*domain.Subscription, error) {
	return &domain.Subscription{}, nil
}
func (s *stubSubRepo) Update(_ context.Context, _ domain.Subscription) error { return nil }
func (s *stubSubRepo) Delete(_ context.Context, _ string) error              { return nil }
func (s *stubSubRepo) ListByTenantID(_ context.Context, _ domain.TenantID) ([]domain.Subscription, error) {
	return nil, nil
}

type stubUsageRepo struct{}

func (s *stubUsageRepo) GetOrCreate(_ context.Context, tid domain.TenantID, _ domain.Product, period string) (*domain.UsageRecord, error) {
	return &domain.UsageRecord{TenantID: tid.String(), Period: period}, nil
}
func (s *stubUsageRepo) IncrementMetric(_ context.Context, _ domain.TenantID, _ domain.Product, _ string, _ domain.UsageMetric, _ int64) error {
	return nil
}
func (s *stubUsageRepo) GetHistory(_ context.Context, _ domain.TenantID, _ domain.Product, _ int) ([]domain.UsageRecord, error) {
	return nil, nil
}

type stubInvoiceRepo struct{}

func (s *stubInvoiceRepo) Create(_ context.Context, _ domain.Invoice) error { return nil }
func (s *stubInvoiceRepo) GetByID(_ context.Context, _ string) (*domain.Invoice, error) {
	return &domain.Invoice{}, nil
}
func (s *stubInvoiceRepo) ListByTenantID(_ context.Context, _ domain.TenantID) ([]domain.Invoice, error) {
	return nil, nil
}
func (s *stubInvoiceRepo) Update(_ context.Context, _ domain.Invoice) error { return nil }

type stubEventRepo struct{}

func (s *stubEventRepo) Append(_ context.Context, _ domain.BillingEvent) error { return nil }
func (s *stubEventRepo) GetByID(_ context.Context, _ string) (*domain.BillingEvent, error) {
	return &domain.BillingEvent{}, nil
}
func (s *stubEventRepo) ListByTenantID(_ context.Context, _ domain.TenantID, _ int) ([]domain.BillingEvent, error) {
	return nil, nil
}
