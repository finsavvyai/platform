package domain

import "testing"

func TestNewBeneficialOwner(t *testing.T) {
	tests := []struct {
		name    string
		tenant  string
		orgID   string
		owner   string
		pct     float64
		wantErr bool
	}{
		{"valid", "tnt_aabbccddee11", "org_1", "John Doe", 25.0, false},
		{"zero pct", "tnt_aabbccddee11", "org_1", "Jane", 0, false},
		{"100 pct", "tnt_aabbccddee11", "org_1", "Owner", 100, false},
		{"over 100", "tnt_aabbccddee11", "org_1", "Bad", 150, true},
		{"negative", "tnt_aabbccddee11", "org_1", "Bad", -5, true},
		{"empty tenant", "", "org_1", "John", 25, true},
		{"empty org", "tnt_aabbccddee11", "", "John", 25, true},
		{"empty name", "tnt_aabbccddee11", "org_1", "", 25, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenant)
			_, err := NewBeneficialOwner(tid, tt.orgID, tt.owner, "US", tt.pct, true)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
