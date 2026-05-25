package domain

import "testing"

func TestNewCaseComment(t *testing.T) {
	tests := []struct {
		name    string
		caseID  string
		content string
		wantErr bool
	}{
		{"valid comment", "case_1", "Investigated and confirmed", false},
		{"empty case id", "", "some note", true},
		{"empty content", "case_1", "", true},
		{"both empty", "", "", true},
		{"long comment", "case_2", "This is a detailed investigation note with findings.", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmt, err := NewCaseComment(tt.caseID, "user_1", tt.content)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if cmt.CaseID != tt.caseID {
				t.Errorf("CaseID = %s, want %s", cmt.CaseID, tt.caseID)
			}
			if cmt.ID == "" {
				t.Error("ID should not be empty")
			}
		})
	}
}
