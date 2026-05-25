package billing

import (
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"
)

// fakeTenantLister satisfies TenantLister with a fixed slice.
type fakeTenantLister struct {
	ids []uuid.UUID
	err error
}

func (f *fakeTenantLister) ListTenantIDs(_ context.Context) ([]uuid.UUID, error) {
	return f.ids, f.err
}

// fakeInvoiceUploader captures uploaded invoices.
type fakeInvoiceUploader struct {
	uploaded []*Invoice
}

func (f *fakeInvoiceUploader) Upload(_ context.Context, inv *Invoice) error {
	f.uploaded = append(f.uploaded, inv)
	return nil
}

// TestMonthlyCron_RunMonth_ThreeModels_1kRequests is the primary "Done when"
// criterion: end-of-month run generates a correct invoice for a fixture
// tenant with 1k requests across 3 models.
func TestMonthlyCron_RunMonth_ThreeModels_1kRequests(t *testing.T) {
	tenant := uuid.New()
	gen := &PostgresInvoiceGenerator{
		Spend: &fakeAgg{items: []LineItem{
			// ~1000 combined requests across 3 provider/model pairs.
			{Provider: "openai", Model: "gpt-4", PromptTokens: 200_000, CompletionTokens: 100_000, USDCents: 120_000},
			{Provider: "anthropic", Model: "claude-3-opus", PromptTokens: 300_000, CompletionTokens: 150_000, USDCents: 200_000},
			{Provider: "anthropic", Model: "claude-3-sonnet", PromptTokens: 100_000, CompletionTokens: 50_000, USDCents: 50_000},
		}},
		Tiers: &fakeTiers{tiers: []Tier{
			{ThresholdUSDCents: 300_000, DiscountPct: 15},
		}},
		Writer: &fakeWriter{},
		Now:    func() time.Time { return time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC) },
	}
	uploader := &fakeInvoiceUploader{}
	cron := NewMonthlyCron(gen, &fakeTenantLister{ids: []uuid.UUID{tenant}}, GoFPDFGenerator{}, uploader, nil)

	if err := cron.RunMonth(context.Background(), 2026, time.March); err != nil {
		t.Fatalf("RunMonth: %v", err)
	}
	if len(uploader.uploaded) != 1 {
		t.Fatalf("expected 1 invoice uploaded, got %d", len(uploader.uploaded))
	}
	inv := uploader.uploaded[0]
	if len(inv.LineItems) != 3 {
		t.Fatalf("expected 3 line items, got %d", len(inv.LineItems))
	}
	// Subtotal = 120_000 + 200_000 + 50_000 = 370_000 cents.
	if inv.SubtotalUSDCents != 370_000 {
		t.Fatalf("subtotal: want 370000 got %d", inv.SubtotalUSDCents)
	}
	// 15% discount: 370_000 * 15 / 100 = 55_500 (integer division).
	if inv.DiscountUSDCents != 55_500 || inv.TotalUSDCents != 314_500 {
		t.Fatalf("discount math: discount=%d total=%d", inv.DiscountUSDCents, inv.TotalUSDCents)
	}
	if inv.AppliedTier == nil || inv.AppliedTier.DiscountPct != 15 {
		t.Fatalf("expected 15%% tier applied: %+v", inv.AppliedTier)
	}
	if inv.TenantID != tenant {
		t.Fatalf("tenant mismatch: %v", inv.TenantID)
	}
	if inv.Year != 2026 || inv.Month != time.March {
		t.Fatalf("period: %d/%s", inv.Year, inv.Month)
	}
}

func TestMonthlyCron_RunMonth_NoTenants(t *testing.T) {
	cron := NewMonthlyCron(
		&PostgresInvoiceGenerator{Spend: &fakeAgg{}, Tiers: &fakeTiers{}},
		&fakeTenantLister{ids: nil},
		nil, nil, nil,
	)
	if err := cron.RunMonth(context.Background(), 2026, time.March); err != nil {
		t.Fatalf("empty tenant list: %v", err)
	}
}

func TestMonthlyCron_RunMonth_NilPDFAndUploader(t *testing.T) {
	tenant := uuid.New()
	gen := &PostgresInvoiceGenerator{
		Spend:  &fakeAgg{items: []LineItem{{Provider: "openai", Model: "gpt-4", USDCents: 10_000}}},
		Tiers:  &fakeTiers{},
		Writer: &fakeWriter{},
	}
	cron := NewMonthlyCron(gen, &fakeTenantLister{ids: []uuid.UUID{tenant}}, nil, nil, nil)
	if err := cron.RunMonth(context.Background(), 2026, time.March); err != nil {
		t.Fatalf("nil pdf/uploader must not error: %v", err)
	}
}

func TestMonthlyCron_RunMonth_TenantListerError(t *testing.T) {
	sentinel := errors.New("db down")
	cron := NewMonthlyCron(
		&PostgresInvoiceGenerator{Spend: &fakeAgg{}, Tiers: &fakeTiers{}},
		&fakeTenantLister{err: sentinel},
		nil, nil, nil,
	)
	err := cron.RunMonth(context.Background(), 2026, time.March)
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
}

func TestMonthlyCron_RunMonth_SkipsBadTenantContinuesRest(t *testing.T) {
	good := uuid.New()
	bad := uuid.New()
	sentinel := errors.New("spend query failed")
	callCount := 0
	agg := &callCountingAgg{
		fn: func(id uuid.UUID) ([]LineItem, error) {
			callCount++
			if id == bad {
				return nil, sentinel
			}
			return []LineItem{{Provider: "openai", Model: "gpt-4", USDCents: 5_000}}, nil
		},
	}
	uploader := &fakeInvoiceUploader{}
	gen := &PostgresInvoiceGenerator{Spend: agg, Tiers: &fakeTiers{}, Writer: &fakeWriter{}}
	cron := NewMonthlyCron(gen, &fakeTenantLister{ids: []uuid.UUID{bad, good}}, nil, uploader, nil)

	err := cron.RunMonth(context.Background(), 2026, time.March)
	if !errors.Is(err, sentinel) {
		t.Fatalf("want sentinel as first error, got %v", err)
	}
	// Good tenant still invoiced despite the bad one.
	if len(uploader.uploaded) != 1 || uploader.uploaded[0].TenantID != good {
		t.Fatalf("good tenant not invoiced: %+v", uploader.uploaded)
	}
}

// callCountingAgg dispatches to a per-call function so individual test
// cases can control the result per tenant.
type callCountingAgg struct {
	fn func(uuid.UUID) ([]LineItem, error)
}

func (a *callCountingAgg) AggregateMonth(_ context.Context, id uuid.UUID, _ int, _ time.Month) ([]LineItem, error) {
	return a.fn(id)
}

// ---------------------------------------------------------------------------
// Run tests — use a 1 ms ticker and injected now() so we don't wait hours.
// ---------------------------------------------------------------------------

func TestMonthlyCron_Run_ContextCancelled(t *testing.T) {
	cron := &MonthlyCron{
		Generator:    &PostgresInvoiceGenerator{Spend: &fakeAgg{}, Tiers: &fakeTiers{}},
		Tenants:      &fakeTenantLister{ids: nil},
		Logger:       slog.Default(),
		now:          time.Now,
		tickInterval: time.Millisecond,
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already cancelled
	err := cron.Run(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("want context.Canceled, got %v", err)
	}
}

func TestMonthlyCron_Run_TickFiresInvoice(t *testing.T) {
	// Inject now() returning the 1st of May so the day-≤3 gate opens
	// and RunMonth fires for April.
	fixedNow := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	uploader := &fakeInvoiceUploader{}
	gen := &PostgresInvoiceGenerator{
		Spend:  &fakeAgg{items: []LineItem{{Provider: "openai", Model: "gpt-4", USDCents: 1_000}}},
		Tiers:  &fakeTiers{},
		Writer: &fakeWriter{},
	}
	cron := &MonthlyCron{
		Generator:    gen,
		Tenants:      &fakeTenantLister{ids: []uuid.UUID{uuid.New()}},
		Uploader:     uploader,
		Logger:       slog.Default(),
		now:          func() time.Time { return fixedNow },
		tickInterval: time.Millisecond,
	}
	// Give the cron enough time for at least one tick to fire.
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	_ = cron.Run(ctx) // returns context.DeadlineExceeded; ignored here
	if len(uploader.uploaded) == 0 {
		t.Fatal("expected at least one invoice to be generated on tick")
	}
	inv := uploader.uploaded[0]
	if inv.Year != 2026 || inv.Month != time.April {
		t.Fatalf("expected April 2026 invoice, got %d/%s", inv.Year, inv.Month)
	}
}

func TestMonthlyCron_Run_SkipsAfterDay3(t *testing.T) {
	// Day 15 of a month: the gate should suppress RunMonth entirely.
	fixedNow := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	uploader := &fakeInvoiceUploader{}
	gen := &PostgresInvoiceGenerator{
		Spend:  &fakeAgg{items: []LineItem{{Provider: "openai", Model: "gpt-4", USDCents: 500}}},
		Tiers:  &fakeTiers{},
		Writer: &fakeWriter{},
	}
	cron := &MonthlyCron{
		Generator:    gen,
		Tenants:      &fakeTenantLister{ids: []uuid.UUID{uuid.New()}},
		Uploader:     uploader,
		Logger:       slog.Default(),
		now:          func() time.Time { return fixedNow },
		tickInterval: time.Millisecond,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_ = cron.Run(ctx)
	if len(uploader.uploaded) != 0 {
		t.Fatalf("expected no invoices after day 3, got %d", len(uploader.uploaded))
	}
}
