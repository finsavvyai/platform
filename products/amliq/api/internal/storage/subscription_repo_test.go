package storage

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMockSubscriptionRepositoryCreate(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	sub, _ := domain.NewSubscription(tid.Value(), domain.ProductAPI, "plan_starter")

	err := repo.Create(context.Background(), sub)
	if err != nil {
		t.Errorf("Create() error = %v", err)
	}
	if _, found := repo.data[sub.ID]; !found {
		t.Errorf("subscription not stored")
	}
}

func TestMockSubscriptionRepositoryGetByTenantID(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	sub, _ := domain.NewSubscription(tid.Value(), domain.ProductAPI, "plan_starter")
	repo.Create(context.Background(), sub)

	got, err := repo.GetByTenantID(context.Background(), tid)
	if err != nil {
		t.Errorf("GetByTenantID() error = %v", err)
	}
	if got.ID != sub.ID {
		t.Errorf("ID = %v, want %v", got.ID, sub.ID)
	}
}

func TestMockSubscriptionRepositoryNotFound(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	_, err := repo.GetByTenantID(context.Background(), tid)
	if err != ErrSubscriptionNotFound {
		t.Errorf("error = %v, want %v", err, ErrSubscriptionNotFound)
	}
}

func TestMockSubscriptionRepositoryGetByLemonSqueezyID(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	sub, _ := domain.NewSubscription(tid.Value(), domain.ProductAPI, "plan_starter")
	sub.LemonSqueezyID = "ls_123456"
	repo.Create(context.Background(), sub)

	got, err := repo.GetByLemonSqueezyID(context.Background(), "ls_123456")
	if err != nil {
		t.Errorf("GetByLemonSqueezyID() error = %v", err)
	}
	if got.LemonSqueezyID != "ls_123456" {
		t.Errorf("LemonSqueezyID = %v, want ls_123456", got.LemonSqueezyID)
	}
}

func TestMockSubscriptionRepositoryUpdate(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	sub, _ := domain.NewSubscription(tid.Value(), domain.ProductAPI, "plan_starter")
	repo.Create(context.Background(), sub)

	sub.Status = domain.StatusActive
	err := repo.Update(context.Background(), sub)
	if err != nil {
		t.Errorf("Update() error = %v", err)
	}

	got, _ := repo.GetByTenantID(context.Background(), tid)
	if got.Status != domain.StatusActive {
		t.Errorf("Status = %v, want %v", got.Status, domain.StatusActive)
	}
}

func TestMockSubscriptionRepositoryListByTenantID(t *testing.T) {
	repo := NewMockSubscriptionRepository()
	tid := newTestTenantID(t)
	sub1, _ := domain.NewSubscription(tid.Value(), domain.ProductAPI, "plan_starter")
	sub2, _ := domain.NewSubscription(tid.Value(), domain.ProductSDK, "plan_pro")
	repo.Create(context.Background(), sub1)
	repo.Create(context.Background(), sub2)

	subs, err := repo.ListByTenantID(context.Background(), tid)
	if err != nil {
		t.Errorf("ListByTenantID() error = %v", err)
	}
	if len(subs) != 2 {
		t.Errorf("ListByTenantID() count = %d, want 2", len(subs))
	}
}
