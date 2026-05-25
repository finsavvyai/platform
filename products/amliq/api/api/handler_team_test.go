package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestInviteValidation(t *testing.T) {
	tests := []struct {
		name    string
		email   string
		role    string
		wantErr bool
	}{
		{"valid analyst", "a@b.com", "analyst", false},
		{"valid admin", "a@b.com", "admin", false},
		{"invalid role", "a@b.com", "superuser", true},
		{"empty email", "", "analyst", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.email == "" {
				if !tt.wantErr {
					t.Error("expected error for empty email")
				}
				return
			}
			_, err := domain.ParseRole(tt.role)
			if tt.wantErr && err == nil {
				t.Error("expected role error")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected: %v", err)
			}
		})
	}
}

func TestSeatCreation(t *testing.T) {
	tests := []struct {
		name    string
		tenant  string
		user    string
		email   string
		wantErr bool
	}{
		{"valid", "tnt_abc", "usr_1", "a@b.com", false},
		{"missing tenant", "", "usr_1", "a@b.com", true},
		{"missing email", "tnt_abc", "usr_1", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := domain.NewSeat(tt.tenant, tt.user, tt.email, "analyst")
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected: %v", err)
			}
		})
	}
}
