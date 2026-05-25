package storage

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMockInvoiceRepositoryListByTenantID(t *testing.T) {
	repo := NewMockInvoiceRepository()
	tenantID := newTestTenantID(t)
	inv1, _ := domain.NewInvoice(tenantID, "sub_1", 50000)
	inv2, _ := domain.NewInvoice(tenantID, "sub_2", 100000)
	repo.Create(context.Background(), inv1)
	repo.Create(context.Background(), inv2)

	invs, err := repo.ListByTenantID(context.Background(), tenantID)
	if err != nil {
		t.Errorf("ListByTenantID() error = %v", err)
	}
	if len(invs) != 2 {
		t.Errorf("ListByTenantID() count = %d, want 2", len(invs))
	}
}

func TestMockInvoiceRepositoryGetByLemonSqueezyID(t *testing.T) {
	repo := NewMockInvoiceRepository()
	tenantID := newTestTenantID(t)
	inv, _ := domain.NewInvoice(tenantID, "sub_456", 50000)
	inv.LemonSqueezyInvoiceID = "ls_inv_123"
	repo.Create(context.Background(), inv)

	got, err := repo.GetByLemonSqueezyID(context.Background(), "ls_inv_123")
	if err != nil {
		t.Errorf("GetByLemonSqueezyID() error = %v", err)
	}
	if got.LemonSqueezyInvoiceID != "ls_inv_123" {
		t.Errorf("LemonSqueezyInvoiceID = %v, want ls_inv_123",
			got.LemonSqueezyInvoiceID)
	}
}

func TestMockInvoiceRepositoryUpdate(t *testing.T) {
	repo := NewMockInvoiceRepository()
	tenantID := newTestTenantID(t)
	inv, _ := domain.NewInvoice(tenantID, "sub_456", 50000)
	repo.Create(context.Background(), inv)

	inv.Status = domain.InvoicePaid
	err := repo.Update(context.Background(), inv)
	if err != nil {
		t.Errorf("Update() error = %v", err)
	}

	got, _ := repo.GetByID(context.Background(), inv.ID)
	if got.Status != domain.InvoicePaid {
		t.Errorf("Status = %v, want %v", got.Status, domain.InvoicePaid)
	}
}
