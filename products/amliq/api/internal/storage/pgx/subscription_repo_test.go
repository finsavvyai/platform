package pgx

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestScanSubscription(t *testing.T) {
	tests := []struct {
		name    string
		product string
		status  string
		wantErr bool
	}{
		{"active api", "api", "active", false},
		{"trialing dashboard", "dashboard", "trialing", false},
		{"cancelled sdk", "sdk", "cancelled", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sub := domain.Subscription{
				ID:        "sub_test_123",
				TenantID:  "tnt_abc123abc123",
				Product:   domain.Product(tt.product),
				PlanID:    "plan_starter",
				Status:    domain.SubscriptionStatus(tt.status),
				CreatedAt: time.Now().UTC(),
				UpdatedAt: time.Now().UTC(),
			}
			if sub.Product == "" {
				t.Error("expected product to be set")
			}
			if tt.status == "active" && !sub.IsActive() {
				t.Error("expected subscription to be active")
			}
		})
	}
}

func TestNullString(t *testing.T) {
	tests := []struct {
		name  string
		input string
		isNil bool
	}{
		{"empty returns nil", "", true},
		{"non-empty returns ptr", "hello", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := nullString(tt.input)
			if tt.isNil && result != nil {
				t.Errorf("expected nil, got %v", *result)
			}
			if !tt.isNil && (result == nil || *result != tt.input) {
				t.Errorf("expected %s", tt.input)
			}
		})
	}
}

func TestNullTime(t *testing.T) {
	tests := []struct {
		name  string
		input time.Time
		isNil bool
	}{
		{"zero returns nil", time.Time{}, true},
		{"non-zero returns ptr", time.Now(), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := nullTime(tt.input)
			if tt.isNil && result != nil {
				t.Error("expected nil")
			}
			if !tt.isNil && result == nil {
				t.Error("expected non-nil")
			}
		})
	}
}
