package domain

import "testing"

func TestNewEvidence(t *testing.T) {
	tests := []struct {
		name     string
		caseID   string
		evType   EvidenceType
		content  string
		wantErr  bool
	}{
		{"valid customer doc", "case_1", EvidenceCustomerDoc, "passport scan", false},
		{"valid analyst note", "case_2", EvidenceAnalystNote, "confirmed match", false},
		{"valid screening result", "case_3", EvidenceScreenResult, `{"score":0.95}`, false},
		{"valid adverse media", "case_4", EvidenceAdverseMedia, "reuters article", false},
		{"valid regulator req", "case_5", EvidenceRegulatorReq, "FCA request #123", false},
		{"empty case id", "", EvidenceAnalystNote, "note", true},
		{"empty content", "case_1", EvidenceAnalystNote, "", true},
		{"invalid type", "case_1", "invalid_type", "content", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ev, err := NewEvidence(tt.caseID, tt.evType, tt.content, "user_1")
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr {
				if ev.ID == "" {
					t.Error("ID should not be empty")
				}
				if ev.Type != tt.evType {
					t.Errorf("Type = %s, want %s", ev.Type, tt.evType)
				}
			}
		})
	}
}

func TestIsValidEvidenceType(t *testing.T) {
	tests := []struct {
		name  string
		evTyp EvidenceType
		want  bool
	}{
		{"customer_doc", EvidenceCustomerDoc, true},
		{"screening_result", EvidenceScreenResult, true},
		{"unknown", "unknown", false},
		{"empty", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidEvidenceType(tt.evTyp)
			if got != tt.want {
				t.Errorf("isValidEvidenceType(%s) = %v, want %v",
					tt.evTyp, got, tt.want)
			}
		})
	}
}
