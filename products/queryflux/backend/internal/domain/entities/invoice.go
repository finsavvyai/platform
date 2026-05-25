package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Invoice represents a billing invoice
type Invoice struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"user_id" db:"user_id"`
	SubscriptionID   *string    `json:"subscription_id" db:"subscription_id"`
	InvoiceNumber    string     `json:"invoice_number" db:"invoice_number"`
	LemonsqueezyID   string     `json:"lemonsqueezy_id" db:"lemonsqueezy_id"`
	Status           string     `json:"status" db:"status"`
	Amount           float64    `json:"amount" db:"amount"`
	Currency         string     `json:"currency" db:"currency"`
	TaxAmount        float64    `json:"tax_amount" db:"tax_amount"`
	TotalAmount      float64    `json:"total_amount" db:"total_amount"`
	DueDate          *time.Time `json:"due_date" db:"due_date"`
	PaidAt           *time.Time `json:"paid_at" db:"paid_at"`
	RefundedAt       *time.Time `json:"refunded_at" db:"refunded_at"`
	RefundAmount     float64    `json:"refund_amount" db:"refund_amount"`
	BillingAddress   string     `json:"billing_address" db:"billing_address"`
	ItemDescription  string     `json:"item_description" db:"item_description"`
	InvoiceURL       string     `json:"invoice_url" db:"invoice_url"`
	DownloadURL      string     `json:"download_url" db:"download_url"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// InvoiceStatus constants
const (
	InvoiceStatusDraft      = "draft"
	InvoiceStatusPending    = "pending"
	InvoiceStatusPaid       = "paid"
	InvoiceStatusVoid       = "void"
	InvoiceStatusRefunded   = "refunded"
	InvoiceStatusPartiallyRefunded = "partially_refunded"
)

// NewInvoice creates a new invoice
func NewInvoice(userID string, amount float64, currency string, description string) *Invoice {
	now := time.Now()

	// Generate invoice number (format: INV-YYYYMMDD-XXXXX)
	invoiceNumber := fmt.Sprintf("INV-%s-%s",
		now.Format("20060102"),
		uuid.New().String()[:5])

	return &Invoice{
		ID:              uuid.New().String(),
		UserID:          userID,
		InvoiceNumber:   invoiceNumber,
		Status:          InvoiceStatusDraft,
		Amount:          amount,
		Currency:        currency,
		TotalAmount:     amount,
		ItemDescription: description,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
}

// MarkAsPaid marks the invoice as paid
func (i *Invoice) MarkAsPaid() {
	i.Status = InvoiceStatusPaid
	now := time.Now()
	i.PaidAt = &now
	i.UpdatedAt = now
}

// MarkAsRefunded marks the invoice as refunded
func (i *Invoice) MarkAsRefunded(refundAmount float64) {
	i.RefundAmount = refundAmount

	if refundAmount >= i.TotalAmount {
		i.Status = InvoiceStatusRefunded
	} else {
		i.Status = InvoiceStatusPartiallyRefunded
	}

	now := time.Now()
	i.RefundedAt = &now
	i.UpdatedAt = now
}

// SetDueDate sets the invoice due date
func (i *Invoice) SetDueDate(dueDate time.Time) {
	i.DueDate = &dueDate
	i.UpdatedAt = time.Now()
}

// UpdateAmounts updates the invoice amounts with tax
func (i *Invoice) UpdateAmounts(amount, taxAmount float64) {
	i.Amount = amount
	i.TaxAmount = taxAmount
	i.TotalAmount = amount + taxAmount
	i.UpdatedAt = time.Now()
}

// SetSubscriptionID associates the invoice with a subscription
func (i *Invoice) SetSubscriptionID(subscriptionID string) {
	i.SubscriptionID = &subscriptionID
	i.UpdatedAt = time.Now()
}

// IsOverdue checks if the invoice is overdue
func (i *Invoice) IsOverdue() bool {
	if i.Status != InvoiceStatusPending || i.DueDate == nil {
		return false
	}
	return i.DueDate.Before(time.Now())
}

// GetDaysOverdue returns the number of days the invoice is overdue
func (i *Invoice) GetDaysOverdue() int {
	if !i.IsOverdue() {
		return 0
	}

	duration := time.Since(*i.DueDate)
	return int(duration.Hours() / 24)
}