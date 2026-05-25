package storage

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestMockBillingEventRepository(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_aabbccddee01")
	tid2, _ := domain.NewTenantID("tnt_aabbccddee02")
	payload := map[string]string{"key": "value"}

	tests := []struct {
		name string
		run  func(t *testing.T)
	}{
		{
			name: "append_and_get_by_id",
			run: func(t *testing.T) {
				repo := newMockBillingEventRepo()
				evt, _ := domain.NewBillingEvent(domain.EventSubscriptionCreated, tid, payload)
				if err := repo.Append(context.Background(), evt); err != nil {
					t.Fatalf("Append failed: %v", err)
				}
				got, err := repo.GetByID(context.Background(), evt.ID)
				if err != nil || got.ID != evt.ID {
					t.Errorf("GetByID failed: err=%v", err)
				}
			},
		},
		{
			name: "get_by_id_not_found",
			run: func(t *testing.T) {
				repo := newMockBillingEventRepo()
				_, err := repo.GetByID(context.Background(), "nonexistent")
				if err != ErrBillingEventNotFound {
					t.Errorf("err=%v, want %v", err, ErrBillingEventNotFound)
				}
			},
		},
		{
			name: "list_by_tenant_id",
			run: func(t *testing.T) {
				repo := newMockBillingEventRepo()
				e1, _ := domain.NewBillingEvent(domain.EventSubscriptionCreated, tid, payload)
				e2, _ := domain.NewBillingEvent(domain.EventPaymentSuccess, tid, payload)
				repo.Append(context.Background(), e1)
				repo.Append(context.Background(), e2)
				evts, err := repo.ListByTenantID(context.Background(), tid, 10)
				if err != nil || len(evts) != 2 {
					t.Errorf("count=%d, want 2", len(evts))
				}
			},
		},
		{
			name: "list_by_type",
			run: func(t *testing.T) {
				repo := newMockBillingEventRepo()
				e1, _ := domain.NewBillingEvent(domain.EventPaymentSuccess, tid, payload)
				e2, _ := domain.NewBillingEvent(domain.EventPaymentSuccess, tid2, payload)
				e3, _ := domain.NewBillingEvent(domain.EventPaymentFailed, tid, payload)
				repo.Append(context.Background(), e1)
				repo.Append(context.Background(), e2)
				repo.Append(context.Background(), e3)
				evts, err := repo.ListByType(context.Background(), domain.EventPaymentSuccess, 10)
				if err != nil || len(evts) != 2 {
					t.Errorf("count=%d, want 2", len(evts))
				}
			},
		},
		{
			name: "list_by_type_limit",
			run: func(t *testing.T) {
				repo := newMockBillingEventRepo()
				for i := 0; i < 5; i++ {
					evt, _ := domain.NewBillingEvent(domain.EventPaymentSuccess, tid, payload)
					repo.Append(context.Background(), evt)
				}
				evts, err := repo.ListByType(context.Background(), domain.EventPaymentSuccess, 2)
				if err != nil || len(evts) != 2 {
					t.Errorf("count=%d, want 2", len(evts))
				}
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, tt.run)
	}
}
