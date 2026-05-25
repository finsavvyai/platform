package domain

import (
	"testing"
	"time"
)

func TestNewSeat(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		userID   string
		email    string
		role     string
		wantErr  bool
	}{
		{"valid", "t1", "u1", "user@example.com", "analyst", false},
		{"missing tenant", "", "u1", "user@example.com", "analyst", true},
		{"missing user", "t1", "", "user@example.com", "analyst", true},
		{"missing email", "t1", "u1", "", "analyst", true},
		{"empty role", "t1", "u1", "user@example.com", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewSeat(tt.tenantID, tt.userID, tt.email, tt.role)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewSeat() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && got.IsActive() != true {
				t.Error("NewSeat() should be active")
			}
		})
	}
}

func TestSeatIsActive(t *testing.T) {
	seat, _ := NewSeat("t1", "u1", "user@example.com", "analyst")
	if !seat.IsActive() {
		t.Error("newly created seat should be active")
	}
	seat.Deactivate()
	if seat.IsActive() {
		t.Error("deactivated seat should not be active")
	}
}

func TestSeatDeactivate(t *testing.T) {
	seat, _ := NewSeat("t1", "u1", "user@example.com", "analyst")
	before := time.Now().UTC()
	seat.Deactivate()
	if seat.DeactivatedAt == nil {
		t.Error("DeactivatedAt should be set")
	}
	if seat.DeactivatedAt.Before(before) {
		t.Error("DeactivatedAt should be after deactivation time")
	}
}
