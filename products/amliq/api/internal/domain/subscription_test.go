package domain

import (
	"testing"
	"time"
)

func TestNewSubscription(t *testing.T) {
	tests := []struct {
		tenantID string
		product  Product
		planID   string
		wantErr  bool
	}{
		{"t1", ProductAPI, "p1", false},
		{"", ProductAPI, "p1", true},
		{"t1", Product("invalid"), "p1", true},
		{"t1", ProductAPI, "", true},
	}
	for _, tt := range tests {
		_, err := NewSubscription(tt.tenantID, tt.product, tt.planID)
		if (err != nil) != tt.wantErr {
			t.Errorf("NewSubscription() error = %v, wantErr %v", err, tt.wantErr)
		}
	}
}

func TestSubscriptionIsActive(t *testing.T) {
	sub, _ := NewSubscription("t1", ProductAPI, "p1")
	if !sub.IsActive() {
		t.Error("new subscription should be active")
	}
	sub.Status = StatusCancelled
	if sub.IsActive() {
		t.Error("cancelled subscription should not be active")
	}
}

func TestSubscriptionIsCancelled(t *testing.T) {
	sub, _ := NewSubscription("t1", ProductAPI, "p1")
	if sub.IsCancelled() {
		t.Error("new subscription should not be cancelled")
	}
	sub.Status = StatusCancelled
	if !sub.IsCancelled() {
		t.Error("cancelled subscription should be cancelled")
	}
}

func TestSubscriptionDaysUntilCancellation(t *testing.T) {
	sub, _ := NewSubscription("t1", ProductAPI, "p1")
	if days := sub.DaysUntilCancellation(); days != -1 {
		t.Errorf("DaysUntilCancellation() = %v, want -1", days)
	}
	future := time.Now().UTC().AddDate(0, 0, 30)
	sub.CancelAt = &future
	days := sub.DaysUntilCancellation()
	if days < 29 || days > 30 {
		t.Errorf("DaysUntilCancellation() = %v, want ~30", days)
	}
}
