package storage

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func newTestTenantID(t *testing.T) domain.TenantID {
	t.Helper()
	tid, err := domain.GenerateTenantID()
	if err != nil {
		t.Fatalf("GenerateTenantID() error = %v", err)
	}
	return tid
}

func TestMockInvoiceRepositoryCreate(t *testing.T) {
	repo := NewMockInvoiceRepository()
	tenantID := newTestTenantID(t)
	inv, _ := domain.NewInvoice(tenantID, "sub_456", 50000)

	err := repo.Create(context.Background(), inv)
	if err != nil {
		t.Errorf("Create() error = %v", err)
	}
	if _, found := repo.data[inv.ID]; !found {
		t.Errorf("invoice not stored")
	}
}

func TestMockInvoiceRepositoryGetByID(t *testing.T) {
	repo := NewMockInvoiceRepository()
	tenantID := newTestTenantID(t)
	inv, _ := domain.NewInvoice(tenantID, "sub_456", 50000)
	repo.Create(context.Background(), inv)

	got, err := repo.GetByID(context.Background(), inv.ID)
	if err != nil {
		t.Errorf("GetByID() error = %v", err)
	}
	if got.ID != inv.ID {
		t.Errorf("ID = %v, want %v", got.ID, inv.ID)
	}
}

func TestMockInvoiceRepositoryGetByIDNotFound(t *testing.T) {
	repo := NewMockInvoiceRepository()
	_, err := repo.GetByID(context.Background(), "nonexistent")
	if err != ErrInvoiceNotFound {
		t.Errorf("GetByID() error = %v, want %v", err, ErrInvoiceNotFound)
	}
}
