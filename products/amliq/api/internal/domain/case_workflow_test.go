package domain

import "testing"

func TestCanTransition(t *testing.T) {
	tests := []struct {
		name string
		from CaseStatus
		to   CaseStatus
		want bool
	}{
		{"open to in_review", CaseOpen, CaseInReview, true},
		{"in_review to escalated", CaseInReview, CaseEscalated, true},
		{"in_review to pending_info", CaseInReview, CasePendingInfo, true},
		{"in_review to resolved", CaseInReview, CaseResolved, true},
		{"escalated to resolved", CaseEscalated, CaseResolved, true},
		{"pending_info to in_review", CasePendingInfo, CaseInReview, true},
		{"resolved to false_positive", CaseResolved, CaseFalsePos, true},
		{"resolved to true_match", CaseResolved, CaseTrueMatch, true},
		{"false_positive to closed", CaseFalsePos, CaseClosed, true},
		{"true_match to closed", CaseTrueMatch, CaseClosed, true},
		{"open to closed", CaseOpen, CaseClosed, false},
		{"closed to open", CaseClosed, CaseOpen, false},
		{"escalated to closed", CaseEscalated, CaseClosed, false},
		{"open to resolved", CaseOpen, CaseResolved, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanTransition(tt.from, tt.to)
			if got != tt.want {
				t.Errorf("CanTransition(%s, %s) = %v, want %v",
					tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestTransitionRequiresComment(t *testing.T) {
	tests := []struct {
		name    string
		from    CaseStatus
		to      CaseStatus
		comment string
		wantErr bool
	}{
		{"escalate with comment", CaseInReview, CaseEscalated, "needs senior", false},
		{"escalate without comment", CaseInReview, CaseEscalated, "", true},
		{"open to review no comment", CaseOpen, CaseInReview, "", false},
		{"resolve with comment", CaseInReview, CaseResolved, "done", false},
		{"resolve without comment", CaseInReview, CaseResolved, "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := NewTenantID("tnt_aabbccddee11")
			c, _ := NewComplianceCase(tid, "scr_1", "E", "M", "ofac", 0.9)
			c.Status = tt.from
			err := c.Transition(tt.to, tt.comment)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}

func TestValidNextStatuses(t *testing.T) {
	next := ValidNextStatuses(CaseInReview)
	if len(next) != 3 {
		t.Errorf("expected 3 next statuses, got %d", len(next))
	}
	next = ValidNextStatuses(CaseClosed)
	if len(next) != 0 {
		t.Errorf("expected 0 next statuses for closed, got %d", len(next))
	}
}
