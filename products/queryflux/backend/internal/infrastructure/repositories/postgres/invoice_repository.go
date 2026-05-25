package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

type invoiceRepository struct {
	db *pgxpool.Pool
}

// NewInvoiceRepository creates a new postgres invoice repository
func NewInvoiceRepository(db *pgxpool.Pool) repositories.InvoiceRepository {
	return &invoiceRepository{
		db: db,
	}
}

func (r *invoiceRepository) Create(ctx context.Context, i *entities.Invoice) error {
	query := `
		INSERT INTO invoices (
			id, user_id, subscription_id, invoice_number, lemonsqueezy_id,
			status, amount, currency, tax_amount, total_amount, due_date,
			paid_at, refunded_at, refund_amount, billing_address,
			item_description, invoice_url, download_url, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
		)
	`
	_, err := r.db.Exec(ctx, query,
		i.ID, i.UserID, i.SubscriptionID, i.InvoiceNumber, i.LemonsqueezyID,
		i.Status, i.Amount, i.Currency, i.TaxAmount, i.TotalAmount, i.DueDate,
		i.PaidAt, i.RefundedAt, i.RefundAmount, i.BillingAddress,
		i.ItemDescription, i.InvoiceURL, i.DownloadURL, i.CreatedAt, i.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create invoice: %w", err)
	}
	return nil
}

func (r *invoiceRepository) GetByID(ctx context.Context, id string) (*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE id = $1`
	return r.scanInvoice(r.db.QueryRow(ctx, query, id))
}

func (r *invoiceRepository) GetByInvoiceNumber(ctx context.Context, invoiceNumber string) (*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE invoice_number = $1`
	return r.scanInvoice(r.db.QueryRow(ctx, query, invoiceNumber))
}

func (r *invoiceRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE lemonsqueezy_id = $1`
	return r.scanInvoice(r.db.QueryRow(ctx, query, lemonSqueezyID))
}

func (r *invoiceRepository) Update(ctx context.Context, i *entities.Invoice) error {
	query := `
		UPDATE invoices SET
			status = $1, amount = $2, tax_amount = $3, total_amount = $4,
			due_date = $5, paid_at = $6, refunded_at = $7, refund_amount = $8,
			billing_address = $9, item_description = $10, invoice_url = $11,
			download_url = $12, updated_at = $13
		WHERE id = $14
	`
	_, err := r.db.Exec(ctx, query,
		i.Status, i.Amount, i.TaxAmount, i.TotalAmount, i.DueDate, i.PaidAt,
		i.RefundedAt, i.RefundAmount, i.BillingAddress, i.ItemDescription,
		i.InvoiceURL, i.DownloadURL, time.Now(), i.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update invoice: %w", err)
	}
	return nil
}

func (r *invoiceRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM invoices WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *invoiceRepository) ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*entities.Invoice
	for rows.Next() {
		i, err := r.scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, i)
	}
	return invoices, nil
}

func (r *invoiceRepository) ListBySubscription(ctx context.Context, subscriptionID string, limit, offset int) ([]*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, subscriptionID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*entities.Invoice
	for rows.Next() {
		i, err := r.scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, i)
	}
	return invoices, nil
}

func (r *invoiceRepository) ListByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, status, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*entities.Invoice
	for rows.Next() {
		i, err := r.scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, i)
	}
	return invoices, nil
}

func (r *invoiceRepository) ListOverdue(ctx context.Context, days int) ([]*entities.Invoice, error) {
	query := `SELECT * FROM invoices WHERE status = 'pending' AND due_date < $1`
	rows, err := r.db.Query(ctx, query, time.Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*entities.Invoice
	for rows.Next() {
		i, err := r.scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, i)
	}
	return invoices, nil
}

func (r *invoiceRepository) GetTotalRevenue(ctx context.Context, startDate, endDate time.Time) (float64, error) {
	query := `SELECT SUM(total_amount) FROM invoices WHERE status = 'paid' AND paid_at BETWEEN $1 AND $2`
	var total float64
	err := r.db.QueryRow(ctx, query, startDate, endDate).Scan(&total)
	return total, err
}

func (r *invoiceRepository) GetRevenueByPlan(ctx context.Context, startDate, endDate time.Time) (map[string]float64, error) {
	query := `
		SELECT s.plan_type, SUM(i.total_amount)
		FROM invoices i
		JOIN subscriptions s ON i.subscription_id = s.id
		WHERE i.status = 'paid' AND i.paid_at BETWEEN $1 AND $2
		GROUP BY s.plan_type
	`
	rows, err := r.db.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	revenue := make(map[string]float64)
	for rows.Next() {
		var plan string
		var amount float64
		if err := rows.Scan(&plan, &amount); err != nil {
			return nil, err
		}
		revenue[plan] = amount
	}
	return revenue, nil
}

func (r *invoiceRepository) CountByStatus(ctx context.Context, status string) (int, error) {
	query := `SELECT COUNT(*) FROM invoices WHERE status = $1`
	var count int
	err := r.db.QueryRow(ctx, query, status).Scan(&count)
	return count, err
}

func (r *invoiceRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	query := `SELECT COUNT(*) FROM invoices WHERE user_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

func (r *invoiceRepository) scanInvoice(row pgx.Row) (*entities.Invoice, error) {
	var i entities.Invoice
	err := row.Scan(
		&i.ID, &i.UserID, &i.SubscriptionID, &i.InvoiceNumber, &i.LemonsqueezyID,
		&i.Status, &i.Amount, &i.Currency, &i.TaxAmount, &i.TotalAmount, &i.DueDate,
		&i.PaidAt, &i.RefundedAt, &i.RefundAmount, &i.BillingAddress,
		&i.ItemDescription, &i.InvoiceURL, &i.DownloadURL, &i.CreatedAt, &i.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("invoice not found")
		}
		return nil, err
	}
	return &i, nil
}
