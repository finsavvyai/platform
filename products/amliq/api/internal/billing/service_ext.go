package billing

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (bs *BillingService) CancelSubscription(ctx context.Context, subID string) error {
	sub, err := bs.subs.GetByLemonSqueezyID(ctx, subID)
	if err != nil {
		return fmt.Errorf("find subscription: %w", err)
	}
	if bs.lsClient != nil && sub.LemonSqueezyID != "" {
		if err := bs.lsClient.CancelSubscription(sub.LemonSqueezyID); err != nil {
			return fmt.Errorf("cancel LS subscription: %w", err)
		}
	}
	sub.Status = domain.StatusCancelled
	return bs.subs.Update(ctx, *sub)
}

func (bs *BillingService) GetUsage(
	ctx context.Context, tenantID domain.TenantID, product domain.Product, period string,
) (*domain.UsageRecord, error) {
	return bs.usage.GetOrCreate(ctx, tenantID, product, period)
}

func (bs *BillingService) RecordUsage(
	ctx context.Context, tenantID domain.TenantID, product domain.Product,
	metric domain.UsageMetric, count int64,
) error {
	period := currentPeriod()
	return bs.usage.IncrementMetric(ctx, tenantID, product, period, metric, count)
}

func (bs *BillingService) GetInvoices(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.Invoice, error) {
	return bs.invoices.ListByTenantID(ctx, tenantID)
}

func (bs *BillingService) CreateSubscription(
	ctx context.Context, tenantID domain.TenantID, sub domain.Subscription,
) error {
	return bs.subs.Create(ctx, sub)
}

func (bs *BillingService) UpdateSubscription(
	ctx context.Context, sub domain.Subscription,
) error {
	return bs.subs.Update(ctx, sub)
}

func (bs *BillingService) RecordEvent(
	ctx context.Context, evt domain.BillingEvent,
) error {
	return bs.events.Append(ctx, evt)
}
