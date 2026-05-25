package domain

import "testing"

func TestNewAdverseMediaHit(t *testing.T) {
	tests := []struct {
		name     string
		entityID string
		tenant   string
		severity int
		wantErr  bool
		wantSev  int
	}{
		{"valid", "ent_1", "tnt_aabbccddee11", 7, false, 7},
		{"severity clamp low", "ent_1", "tnt_aabbccddee11", 0, false, 5},
		{"severity clamp high", "ent_1", "tnt_aabbccddee11", 15, false, 5},
		{"empty entity", "", "tnt_aabbccddee11", 5, true, 0},
		{"empty tenant", "ent_1", "", 5, true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenant)
			hit, err := NewAdverseMediaHit(
				tt.entityID, tid, MediaFraud,
				"Reuters", "Title", "https://example.com", tt.severity,
			)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && hit.Severity != tt.wantSev {
				t.Errorf("severity=%d, want=%d", hit.Severity, tt.wantSev)
			}
		})
	}
}
