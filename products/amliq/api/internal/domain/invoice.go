package domain

import (
	"fmt"
	"time"
)

type InvoiceStatus string

const (
	InvoiceDraft InvoiceStatus = "draft"
	InvoiceOpen  InvoiceStatus = "open"
	InvoicePaid  InvoiceStatus = "paid"
	InvoiceVoid  InvoiceStatus = "void"
)

type Invoice struct {
	ID                    string
	TenantID              TenantID
	SubscriptionID        string
	AmountCents           int
	Currency              string
	Status                InvoiceStatus
	PeriodStart           time.Time
	PeriodEnd             time.Time
	PaidAt                *time.Time
	LemonSqueezyInvoiceID string
	URL                   string
	CreatedAt             time.Time
}

func NewInvoice(tenantID TenantID, subscriptionID string, amountCents int) (Invoice, error) {
	if tenantID.IsZero() || subscriptionID == "" || amountCents < 0 {
		return Invoice{}, fmt.Errorf("tenant_id, subscription_id required, amount non-negative")
	}
	now := time.Now().UTC()
	return Invoice{
		ID:             fmt.Sprintf("inv_%d", now.UnixNano()),
		TenantID:       tenantID,
		SubscriptionID: subscriptionID,
		AmountCents:    amountCents,
		Currency:       "USD",
		Status:         InvoiceDraft,
		CreatedAt:      now,
	}, nil
}

func (i Invoice) AmountUSD() float64 {
	return float64(i.AmountCents) / 100.0
}

func (i Invoice) IsPaid() bool {
	return i.Status == InvoicePaid && i.PaidAt != nil
}

func (i Invoice) IsOpen() bool {
	return i.Status == InvoiceOpen || i.Status == InvoiceDraft
}

func (i Invoice) String() string {
	return fmt.Sprintf("Invoice(%s, $%.2f %s)", i.ID, i.AmountUSD(), i.Status)
}
