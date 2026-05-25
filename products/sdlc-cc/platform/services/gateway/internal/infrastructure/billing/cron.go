// MonthlyCron fires invoice generation for every active tenant once per
// calendar month. It polls every 6 hours and runs in the first 3 days of
// each new month for the previous month's spend. Idempotent: Writers should
// upsert on (tenant_id, year, month).
//
// Day 31 of the production-ready roadmap (Phase 2 Track B).
package billing

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// TenantLister returns the IDs of all tenants that should receive an
// invoice. Real impl queries the tenants table; tests pass an in-memory stub.
type TenantLister interface {
	ListTenantIDs(ctx context.Context) ([]uuid.UUID, error)
}

// MonthlyCron drives end-of-month invoice generation across all tenants.
// PDF and Uploader are optional; nil fields are silently skipped.
type MonthlyCron struct {
	Generator    InvoiceGenerator
	Tenants      TenantLister
	PDF          PDFGenerator
	Uploader     InvoiceUploader
	Logger       *slog.Logger
	now          func() time.Time
	tickInterval time.Duration // if 0 defaults to 6 h; override in tests
}

// NewMonthlyCron constructs the cron. Pass nil for pdf/uploader to skip
// those steps (useful in dev/test without live Stripe credentials).
func NewMonthlyCron(
	gen InvoiceGenerator,
	tenants TenantLister,
	pdf PDFGenerator,
	uploader InvoiceUploader,
	logger *slog.Logger,
) *MonthlyCron {
	if logger == nil {
		logger = slog.Default()
	}
	return &MonthlyCron{
		Generator: gen,
		Tenants:   tenants,
		PDF:       pdf,
		Uploader:  uploader,
		Logger:    logger,
		now:       time.Now,
	}
}

// Run blocks until ctx is cancelled. It checks every 6 hours; within the
// first 3 days of a new month it generates invoices for the previous month.
// For multi-node deployments wrap this in a Postgres advisory-lock leader
// election so only one node fires the run.
func (c *MonthlyCron) Run(ctx context.Context) error {
	interval := c.tickInterval
	if interval == 0 {
		interval = 6 * time.Hour
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	var lastRan time.Month
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			t := c.now().UTC()
			if t.Day() > 3 || t.Month() == lastRan {
				continue
			}
			prev := t.AddDate(0, -1, 0)
			if err := c.RunMonth(ctx, prev.Year(), prev.Month()); err != nil {
				c.Logger.Error("monthly billing run failed",
					slog.Int("year", prev.Year()),
					slog.String("month", prev.Month().String()),
					slog.Any("err", err),
				)
			}
			lastRan = t.Month()
		}
	}
}

// RunMonth generates (and optionally uploads) invoices for all tenants
// for the given period. Returns the first error but continues on remaining
// tenants so a single bad tenant does not block others.
func (c *MonthlyCron) RunMonth(ctx context.Context, year int, month time.Month) error {
	ids, err := c.Tenants.ListTenantIDs(ctx)
	if err != nil {
		return err
	}
	var firstErr error
	for _, id := range ids {
		inv, genErr := c.Generator.GenerateMonthly(ctx, id, year, month)
		if genErr != nil {
			c.Logger.Error("invoice generation failed",
				slog.String("tenant", id.String()), slog.Any("err", genErr))
			if firstErr == nil {
				firstErr = genErr
			}
			continue
		}
		if c.PDF != nil {
			if _, pdfErr := c.PDF.Generate(inv); pdfErr != nil {
				c.Logger.Warn("PDF generation failed",
					slog.String("tenant", id.String()), slog.Any("err", pdfErr))
			}
		}
		if c.Uploader != nil {
			if upErr := c.Uploader.Upload(ctx, inv); upErr != nil {
				c.Logger.Warn("invoice upload failed",
					slog.String("tenant", id.String()), slog.Any("err", upErr))
			}
		}
	}
	return firstErr
}
