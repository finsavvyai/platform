package domain

import (
	"testing"
	"time"
)

func TestNewOngoingMonitor(t *testing.T) {
	tests := []struct {
		name    string
		tenant  string
		entity  string
		freq    string
		wantErr bool
	}{
		{"valid daily", "tnt_aabbccddee11", "John Doe", "daily", false},
		{"valid weekly", "tnt_aabbccddee11", "Acme Corp", "weekly", false},
		{"valid monthly", "tnt_aabbccddee11", "Test", "monthly", false},
		{"default freq", "tnt_aabbccddee11", "Test", "", false},
		{"empty tenant", "", "John", "daily", true},
		{"empty name", "tnt_aabbccddee11", "", "daily", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenant)
			m, err := NewOngoingMonitor(tid, tt.entity, EntityTypeIndividual, tt.freq)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr {
				if m.Status != MonitorActive {
					t.Errorf("status=%s, want active", m.Status)
				}
				if m.NextScreen.Before(time.Now()) {
					t.Error("next screen should be in the future")
				}
			}
		})
	}
}
