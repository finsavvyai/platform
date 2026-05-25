package billing

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// BillingService manages subscriptions, usage, and seats via PG + LS.
type BillingService struct {
	lsClient *LemonSqueezyClient
	lsCfg    *LemonSqueezyConfig
	subs     storage.SubscriptionRepository
	usage    storage.UsageRepository
	invoices storage.InvoiceRepository
	events   storage.BillingEventRepository
}

func NewBillingService(
	lsCfg *LemonSqueezyConfig,
	subs storage.SubscriptionRepository,
	usage storage.UsageRepository,
	invoices storage.InvoiceRepository,
	events storage.BillingEventRepository,
) *BillingService {
	var client *LemonSqueezyClient
	if lsCfg != nil && lsCfg.APIKey != "" {
		client = NewLemonSqueezyClient(lsCfg.APIKey)
	}
	return &BillingService{
		lsClient: client,
		lsCfg:    lsCfg,
		subs:     subs,
		usage:    usage,
		invoices: invoices,
		events:   events,
	}
}

func (bs *BillingService) CreateCheckout(
	ctx context.Context, tenantID domain.TenantID, req CheckoutRequest,
) (string, error) {
	if err := ValidateCheckoutRequest(req); err != nil {
		return "", err
	}
	req.TenantID = tenantID.String()

	checkoutURL, err := CreateCheckoutURL(bs.lsCfg, req)
	if err != nil {
		return "", fmt.Errorf("create checkout URL: %w", err)
	}
	return checkoutURL, nil
}

func (bs *BillingService) GetSubscriptions(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.Subscription, error) {
	return bs.subs.ListByTenantID(ctx, tenantID)
}

func (bs *BillingService) GetSubscription(
	ctx context.Context, tenantID domain.TenantID,
) (*domain.Subscription, error) {
	return bs.subs.GetByTenantID(ctx, tenantID)
}
