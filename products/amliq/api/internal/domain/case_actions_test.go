package domain

import (
	"testing"
)

func TestCaseAssign(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	tests := []struct {
		name     string
		userID   string
		wantStat CaseStatus
	}{
		{"assign analyst", "user_123", CaseInReview},
		{"assign manager", "user_456", CaseInReview},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := NewComplianceCase(tid, "scr_1", "John", "John Doe", "OFAC", 0.85)
			c.Assign(tt.userID)
			if c.AssignedTo != tt.userID {
				t.Errorf("AssignedTo = %s, want %s", c.AssignedTo, tt.userID)
			}
			if c.Status != tt.wantStat {
				t.Errorf("Status = %s, want %s", c.Status, tt.wantStat)
			}
		})
	}
}

func TestCaseEscalate(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	c, _ := NewComplianceCase(tid, "scr_1", "John", "John Doe", "OFAC", 0.85)
	c.Escalate()
	if c.Status != CaseEscalated {
		t.Errorf("Status = %s, want escalated", c.Status)
	}
	if c.Priority != PriorityCritical {
		t.Errorf("Priority = %s, want critical", c.Priority)
	}
}

func TestCaseResolve(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	tests := []struct {
		name       string
		resolution string
		trueMatch  bool
		wantStatus CaseStatus
		wantErr    bool
	}{
		{"true match", "confirmed sanctions hit", true, CaseTrueMatch, false},
		{"false positive", "name coincidence", false, CaseFalsePos, false},
		{"empty resolution", "", false, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := NewComplianceCase(tid, "scr_1", "John", "John Doe", "OFAC", 0.85)
			err := c.Resolve("user_1", tt.resolution, tt.trueMatch)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if c.Status != tt.wantStatus {
				t.Errorf("Status = %s, want %s", c.Status, tt.wantStatus)
			}
			if c.ResolvedAt == nil {
				t.Error("ResolvedAt should be set")
			}
		})
	}
}
