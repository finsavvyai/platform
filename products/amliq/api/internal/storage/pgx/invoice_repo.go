package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type InvoiceRepository struct {
	db *sql.DB
}

func NewInvoiceRepository(db *sql.DB) *InvoiceRepository {
	return &InvoiceRepository{db: db}
}

func (r *InvoiceRepository) Create(ctx context.Context, inv domain.Invoice) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO invoices (
			id, tenant_id, subscription_id, amount_cents, currency, status,
			period_start, period_end, paid_at,
			lemonsqueezy_invoice_id, invoice_url, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		inv.ID, inv.TenantID.String(), inv.SubscriptionID,
		inv.AmountCents, inv.Currency, string(inv.Status),
		inv.PeriodStart, inv.PeriodEnd, inv.PaidAt,
		nullString(inv.LemonSqueezyInvoiceID), nullString(inv.URL),
		inv.CreatedAt,
	)
	return err
}

func (r *InvoiceRepository) GetByID(ctx context.Context, id string) (*domain.Invoice, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, subscription_id, amount_cents, currency, status,
		       period_start, period_end, paid_at,
		       lemonsqueezy_invoice_id, invoice_url, created_at
		FROM invoices WHERE id=$1`, id)
	return scanInvoice(row)
}

func (r *InvoiceRepository) ListByTenantID(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.Invoice, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, subscription_id, amount_cents, currency, status,
		       period_start, period_end, paid_at,
		       lemonsqueezy_invoice_id, invoice_url, created_at
		FROM invoices WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID.String())
	if err != nil {
		return nil, fmt.Errorf("list invoices: %w", err)
	}
	defer rows.Close()
	return collectInvoices(rows)
}

func (r *InvoiceRepository) Update(ctx context.Context, inv domain.Invoice) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE invoices SET status=$1, paid_at=$2 WHERE id=$3`,
		string(inv.Status), inv.PaidAt, inv.ID,
	)
	return err
}
