package domain

import "testing"

func TestNewEDDReport(t *testing.T) {
	tests := []struct {
		name     string
		tenant   string
		entityID string
		wantErr  bool
	}{
		{"valid", "tnt_aabbccddee11", "ent_1", false},
		{"empty tenant", "", "ent_1", true},
		{"empty entity", "tnt_aabbccddee11", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenant)
			rpt, err := NewEDDReport(tid, tt.entityID, "Test Entity", "case_1")
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr {
				if rpt.Status != EDDInitiated {
					t.Errorf("status=%s, want initiated", rpt.Status)
				}
				if len(rpt.Checklist) != 8 {
					t.Errorf("checklist items=%d, want 8", len(rpt.Checklist))
				}
				for _, done := range rpt.Checklist {
					if done {
						t.Error("checklist items should start as false")
					}
				}
			}
		})
	}
}
