package domain

import (
	"fmt"
	"time"
)

type Subscription struct {
	ID                 string
	TenantID           string
	Product            Product
	PlanID             string
	LemonSqueezyID     string
	Status             SubscriptionStatus
	SeatCount          int
	PromoCode          string
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   time.Time
	CancelAt           *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func NewSubscription(tenantID string, product Product, planID string) (Subscription, error) {
	if tenantID == "" || !product.IsValid() || planID == "" {
		return Subscription{}, fmt.Errorf("tenant_id, product, and plan_id required")
	}
	now := time.Now().UTC()
	return Subscription{
		ID:        fmt.Sprintf("sub_%d", now.UnixNano()),
		TenantID:  tenantID,
		Product:   product,
		PlanID:    planID,
		Status:    StatusActive,
		SeatCount: 0,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (s Subscription) IsActive() bool {
	return s.Status.IsActive()
}

func (s Subscription) IsCancelled() bool {
	return s.Status == StatusCancelled
}

func (s Subscription) IsExpired() bool {
	return s.Status == StatusExpired
}

func (s Subscription) DaysUntilCancellation() int {
	if s.CancelAt == nil {
		return -1
	}
	days := int(s.CancelAt.Sub(time.Now().UTC()).Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

func (s Subscription) String() string {
	return fmt.Sprintf("Subscription(%s, tenant=%s, product=%s, status=%s)", s.ID, s.TenantID, s.Product, s.Status)
}
