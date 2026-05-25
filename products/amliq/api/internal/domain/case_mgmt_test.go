package domain

import "testing"

func TestNewComplianceCase(t *testing.T) {
	tests := []struct {
		name        string
		tenantID    string
		screeningID string
		confidence  float64
		wantErr     bool
		wantPrio    CasePriority
	}{
		{"valid critical", "tnt_aabbccddee11", "scr_1", 0.96, false, PriorityCritical},
		{"valid high", "tnt_aabbccddee11", "scr_2", 0.90, false, PriorityHigh},
		{"valid medium", "tnt_aabbccddee11", "scr_3", 0.75, false, PriorityMedium},
		{"valid low", "tnt_aabbccddee11", "scr_4", 0.50, false, PriorityLow},
		{"empty tenant", "", "scr_1", 0.9, true, ""},
		{"empty screening", "tnt_aabbccddee11", "", 0.9, true, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID(tt.tenantID)
			c, err := NewComplianceCase(tid, tt.screeningID, "John", "John Doe", "ofac", tt.confidence)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && c.Priority != tt.wantPrio {
				t.Errorf("priority=%s, want=%s", c.Priority, tt.wantPrio)
			}
		})
	}
}

func TestCaseActions(t *testing.T) {
	tid, _ := NewTenantID("tnt_aabbccddee11")
	c, _ := NewComplianceCase(tid, "scr_1", "Test", "Test Match", "ofac", 0.9)

	c.Assign("user_123")
	if c.Status != CaseInReview || c.AssignedTo != "user_123" {
		t.Errorf("Assign failed: status=%s, assigned=%s", c.Status, c.AssignedTo)
	}

	c.Escalate()
	if c.Status != CaseEscalated || c.Priority != PriorityCritical {
		t.Errorf("Escalate failed: status=%s, prio=%s", c.Status, c.Priority)
	}

	err := c.Resolve("user_123", "", false)
	if err == nil {
		t.Error("expected error for empty resolution")
	}

	err = c.Resolve("user_123", "confirmed match", true)
	if err != nil || c.Status != CaseTrueMatch {
		t.Errorf("Resolve failed: err=%v, status=%s", err, c.Status)
	}
}
