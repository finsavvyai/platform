package domain

import (
	"testing"
	"time"
)

func invoiceTenantID(t *testing.T) TenantID {
	t.Helper()
	tid, err := NewTenantID("tnt_aabbccddeeff")
	if err != nil {
		t.Fatalf("NewTenantID() error = %v", err)
	}
	return tid
}

func TestNewInvoice(t *testing.T) {
	tid := invoiceTenantID(t)
	inv, err := NewInvoice(tid, "s456", 50000)
	if err != nil || inv.TenantID != tid || inv.Status != InvoiceDraft {
		t.Errorf("NewInvoice failed")
	}
}

func TestNewInvoiceValidation(t *testing.T) {
	tid := invoiceTenantID(t)
	tests := []struct {
		name string
		tid  TenantID
		sid  string
		amt  int
		err  bool
	}{
		{"valid", tid, "s456", 50000, false},
		{"no tenant", TenantID{}, "s456", 50000, true},
		{"no sub", tid, "", 50000, true},
		{"negative", tid, "s456", -1, true},
	}
	for _, tt := range tests {
		_, err := NewInvoice(tt.tid, tt.sid, tt.amt)
		if (err != nil) != tt.err {
			t.Errorf("%s: err=%v, want=%v", tt.name, err != nil, tt.err)
		}
	}
}

func TestInvoiceAmountUSD(t *testing.T) {
	tid := invoiceTenantID(t)
	inv, _ := NewInvoice(tid, "s456", 50000)
	if inv.AmountUSD() != 500.00 {
		t.Errorf("AmountUSD=%v, want 500.00", inv.AmountUSD())
	}
}

func TestInvoiceIsPaid(t *testing.T) {
	tid := invoiceTenantID(t)
	inv, _ := NewInvoice(tid, "s456", 50000)
	if inv.IsPaid() {
		t.Errorf("IsPaid=true, want false")
	}
	inv.Status = InvoicePaid
	if inv.IsPaid() {
		t.Errorf("IsPaid=true, want false (no PaidAt)")
	}
	now := time.Now().UTC()
	inv.PaidAt = &now
	if !inv.IsPaid() {
		t.Errorf("IsPaid=false, want true")
	}
}

func TestInvoiceIsOpen(t *testing.T) {
	tid := invoiceTenantID(t)
	inv, _ := NewInvoice(tid, "s456", 50000)
	if !inv.IsOpen() {
		t.Errorf("IsOpen draft=false")
	}
	inv.Status = InvoiceOpen
	if !inv.IsOpen() {
		t.Errorf("IsOpen open=false")
	}
	inv.Status = InvoicePaid
	if inv.IsOpen() {
		t.Errorf("IsOpen paid=true")
	}
}
