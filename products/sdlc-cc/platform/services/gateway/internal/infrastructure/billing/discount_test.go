package billing

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestApplyDiscount_NoTiers(t *testing.T) {
	if got := applyDiscount(10_000, nil); got != 10_000 {
		t.Fatalf("nil tiers must be no-op, got %d", got)
	}
	if got := applyDiscount(10_000, []Tier{}); got != 10_000 {
		t.Fatalf("empty tiers must be no-op, got %d", got)
	}
}

func TestApplyDiscount_BelowFirstThreshold(t *testing.T) {
	tiers := []Tier{
		{ThresholdUSDCents: 50_000, DiscountPct: 10},
	}
	// $499.99 < $500 threshold
	if got := applyDiscount(49_999, tiers); got != 49_999 {
		t.Fatalf("below threshold must be unchanged, got %d", got)
	}
}

func TestApplyDiscount_HighestQualifyingTierWins(t *testing.T) {
	tiers := []Tier{
		{ThresholdUSDCents: 10_000, DiscountPct: 5},   // $100  -> 5%
		{ThresholdUSDCents: 100_000, DiscountPct: 10}, // $1000 -> 10%
		{ThresholdUSDCents: 500_000, DiscountPct: 20}, // $5000 -> 20%
	}
	// Subtotal $2000 → only first two qualify; 10% wins.
	if got := applyDiscount(200_000, tiers); got != 180_000 {
		t.Fatalf("want 180000 got %d", got)
	}
	// Subtotal $6000 → all three qualify; 20% wins.
	if got := applyDiscount(600_000, tiers); got != 480_000 {
		t.Fatalf("want 480000 got %d", got)
	}
}

func TestApplyDiscount_PctClamped(t *testing.T) {
	tiers := []Tier{
		{ThresholdUSDCents: 100, DiscountPct: 250}, // bogus 250%
	}
	// Should clamp to 100% → total 0, not negative.
	if got := applyDiscount(10_000, tiers); got != 0 {
		t.Fatalf("clamped 100%% must zero out, got %d", got)
	}
	tiers[0].DiscountPct = -50 // bogus negative
	if got := applyDiscount(10_000, tiers); got != 10_000 {
		t.Fatalf("negative pct must clamp to 0, got %d", got)
	}
}

func TestApplyDiscount_ZeroSubtotal(t *testing.T) {
	tiers := []Tier{{ThresholdUSDCents: 0, DiscountPct: 50}}
	if got := applyDiscount(0, tiers); got != 0 {
		t.Fatalf("zero subtotal stays zero, got %d", got)
	}
}

// ---------------------------------------------------------------------------
// PostgresInvoiceGenerator integration with in-memory fakes.
// ---------------------------------------------------------------------------

type fakeAgg struct {
	items []LineItem
	err   error
}

func (f *fakeAgg) AggregateMonth(_ context.Context, _ uuid.UUID, _ int, _ time.Month) ([]LineItem, error) {
	return f.items, f.err
}

type fakeTiers struct {
	tiers []Tier
	err   error
}

func (f *fakeTiers) TiersForTenant(_ context.Context, _ uuid.UUID) ([]Tier, error) {
	return f.tiers, f.err
}

type fakeWriter struct {
	saved *Invoice
}

func (f *fakeWriter) Save(_ context.Context, inv *Invoice) error {
	f.saved = inv
	return nil
}

func TestGenerateMonthly_HappyPath(t *testing.T) {
	tenant := uuid.New()
	gen := &PostgresInvoiceGenerator{
		Spend: &fakeAgg{items: []LineItem{
			{Provider: "openai", Model: "gpt-4", USDCents: 50_000},
			{Provider: "anthropic", Model: "claude-3-opus", USDCents: 150_000},
		}},
		Tiers: &fakeTiers{tiers: []Tier{
			{ThresholdUSDCents: 100_000, DiscountPct: 10},
		}},
		Writer: &fakeWriter{},
		Now:    func() time.Time { return time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC) },
	}
	inv, err := gen.GenerateMonthly(context.Background(), tenant, 2026, time.March)
	if err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if inv.SubtotalUSDCents != 200_000 {
		t.Fatalf("subtotal: %d", inv.SubtotalUSDCents)
	}
	if inv.DiscountUSDCents != 20_000 || inv.TotalUSDCents != 180_000 {
		t.Fatalf("discount math: discount=%d total=%d", inv.DiscountUSDCents, inv.TotalUSDCents)
	}
	if inv.AppliedTier == nil || inv.AppliedTier.DiscountPct != 10 {
		t.Fatalf("tier not recorded: %+v", inv.AppliedTier)
	}
	if inv.Status != "draft" {
		t.Fatalf("status: %s", inv.Status)
	}
}

func TestGenerateMonthly_InvalidPeriod(t *testing.T) {
	gen := &PostgresInvoiceGenerator{Spend: &fakeAgg{}, Tiers: &fakeTiers{}}
	if _, err := gen.GenerateMonthly(context.Background(), uuid.New(), 2026, time.Month(13)); err != ErrInvalidPeriod {
		t.Fatalf("want ErrInvalidPeriod, got %v", err)
	}
	if _, err := gen.GenerateMonthly(context.Background(), uuid.New(), 1900, time.January); err != ErrInvalidPeriod {
		t.Fatalf("want ErrInvalidPeriod for ancient year, got %v", err)
	}
}
