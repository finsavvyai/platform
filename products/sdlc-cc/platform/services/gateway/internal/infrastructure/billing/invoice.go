// Package billing aggregates spend_events into monthly invoices and
// applies contract-level volume discounts. Real Stripe / PDF / email
// integration is intentionally NOT included here — see stripe_uploader.go
// and pdf_generator.go for the SCAFFOLD shims.
//
// Day 31 of the production-ready roadmap (Phase 2 Track B).
package billing

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Invoice is the materialised monthly bill for one tenant.
type Invoice struct {
	ID                uuid.UUID
	TenantID          uuid.UUID
	Year              int
	Month             time.Month
	SubtotalUSDCents  int64
	DiscountUSDCents  int64
	TotalUSDCents     int64
	Status            string // 'draft' | 'finalized' | 'sent' | 'paid' | 'void'
	GeneratedAt       time.Time
	LineItems         []LineItem
	AppliedTier       *Tier // nil if no discount applied
}

// LineItem is one (provider, model) row aggregated for the period.
type LineItem struct {
	Provider         string
	Model            string
	PromptTokens     int64
	CompletionTokens int64
	USDCents         int64
}

// SpendAggregator pulls (provider, model, tokens, cents) sums for the
// given tenant + month from spend_events. Real impl wraps Postgres;
// tests pass an in-memory fake.
type SpendAggregator interface {
	AggregateMonth(ctx context.Context, tenantID uuid.UUID, year int, month time.Month) ([]LineItem, error)
}

// TierLoader returns the discount tiers configured for a tenant's
// active contract. Returns an empty slice when no tiers are configured
// (i.e. retail pricing applies).
type TierLoader interface {
	TiersForTenant(ctx context.Context, tenantID uuid.UUID) ([]Tier, error)
}

// InvoiceWriter persists the generated invoice. Real impl writes to
// the `invoices` + `invoice_line_items` tables from migration 015.
type InvoiceWriter interface {
	Save(ctx context.Context, inv *Invoice) error
}

// InvoiceGenerator is the public seam used by the monthly cron job.
type InvoiceGenerator interface {
	GenerateMonthly(ctx context.Context, tenantID uuid.UUID, year int, month time.Month) (*Invoice, error)
}

// PostgresInvoiceGenerator is the concrete generator. It composes
// the three persistence interfaces above so tests can swap any one.
type PostgresInvoiceGenerator struct {
	Spend  SpendAggregator
	Tiers  TierLoader
	Writer InvoiceWriter
	Now    func() time.Time
}

// ErrInvalidPeriod is returned when an obviously bogus year/month is
// passed (e.g. month=13).
var ErrInvalidPeriod = errors.New("billing: invalid year or month")

// GenerateMonthly aggregates spend_events for the period, applies
// the largest qualifying discount tier, persists the invoice, and
// returns it.
func (g *PostgresInvoiceGenerator) GenerateMonthly(
	ctx context.Context,
	tenantID uuid.UUID,
	year int,
	month time.Month,
) (*Invoice, error) {
	if month < time.January || month > time.December || year < 2020 || year > 2100 {
		return nil, ErrInvalidPeriod
	}

	items, err := g.Spend.AggregateMonth(ctx, tenantID, year, month)
	if err != nil {
		return nil, err
	}
	tiers, err := g.Tiers.TiersForTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	subtotal := sumLineItems(items)
	total, applied := applyDiscountWithTier(subtotal, tiers)
	discount := subtotal - total

	now := time.Now().UTC()
	if g.Now != nil {
		now = g.Now()
	}
	inv := &Invoice{
		ID:               uuid.New(),
		TenantID:         tenantID,
		Year:             year,
		Month:            month,
		SubtotalUSDCents: subtotal,
		DiscountUSDCents: discount,
		TotalUSDCents:    total,
		Status:           "draft",
		GeneratedAt:      now,
		LineItems:        items,
		AppliedTier:      applied,
	}

	if g.Writer != nil {
		if err := g.Writer.Save(ctx, inv); err != nil {
			return nil, err
		}
	}
	return inv, nil
}

// sumLineItems is a pure helper. Exported in tests indirectly via
// applyDiscount round-trip but kept private here.
func sumLineItems(items []LineItem) int64 {
	var sum int64
	for _, it := range items {
		sum += it.USDCents
	}
	return sum
}
