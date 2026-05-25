package pgx

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func scanInvoice(row subscriptionScanner) (*domain.Invoice, error) {
	var inv domain.Invoice
	var tenantStr, status string
	var lsID, invURL sql.NullString
	var paidAt *time.Time

	err := row.Scan(
		&inv.ID, &tenantStr, &inv.SubscriptionID,
		&inv.AmountCents, &inv.Currency, &status,
		&inv.PeriodStart, &inv.PeriodEnd, &paidAt,
		&lsID, &invURL, &inv.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invoice not found")
		}
		return nil, fmt.Errorf("scan invoice: %w", err)
	}

	tenantID, _ := domain.NewTenantID(tenantStr)
	inv.TenantID = tenantID
	inv.Status = domain.InvoiceStatus(status)
	if lsID.Valid {
		inv.LemonSqueezyInvoiceID = lsID.String
	}
	if invURL.Valid {
		inv.URL = invURL.String
	}
	inv.PaidAt = paidAt
	return &inv, nil
}

func collectInvoices(rows *sql.Rows) ([]domain.Invoice, error) {
	var invs []domain.Invoice
	for rows.Next() {
		inv, err := scanInvoice(rows)
		if err != nil {
			return nil, err
		}
		invs = append(invs, *inv)
	}
	return invs, rows.Err()
}
