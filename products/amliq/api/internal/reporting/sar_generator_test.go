package reporting

import (
	"context"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockAI struct {
	response string
	err      error
}

func (m *mockAI) Generate(_ context.Context, _ string) (string, error) {
	return m.response, m.err
}

func TestGenerateNarrative(t *testing.T) {
	tests := []struct {
		name     string
		response string
		wantErr  bool
	}{
		{"successful narrative", "The subject engaged in structuring...", false},
		{"empty response still valid", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gen := NewSARGenerator(&mockAI{response: tt.response})
			ev := CaseEvidence{
				CaseID: "case_1", SubjectName: "John Doe",
				SubjectType: "individual",
				DateFrom: time.Now().AddDate(0, -3, 0),
				DateTo:   time.Now(),
			}
			narrative, err := gen.GenerateNarrative(context.Background(), ev)
			if (err != nil) != tt.wantErr {
				t.Errorf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && narrative != tt.response {
				t.Errorf("narrative=%q, want=%q", narrative, tt.response)
			}
		})
	}
}

func TestGenerateSAR(t *testing.T) {
	gen := NewSARGenerator(&mockAI{response: "Suspicious activity detected..."})
	tid, _ := domain.NewTenantID("tnt_aabbccddee11")
	ev := CaseEvidence{
		CaseID: "case_1", SubjectName: "Jane Corp",
		SubjectType: "entity", TotalAmount: 5000000,
		DateFrom: time.Now().AddDate(0, -6, 0),
		DateTo:   time.Now(),
		Alerts: []domain.TxnAlert{
			{AlertType: domain.TxnStructuring},
		},
	}
	sar, err := gen.GenerateSAR(
		context.Background(), tid, ev, domain.RegulatorFinCEN,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sar.SubjectName != "Jane Corp" {
		t.Errorf("subject=%s, want Jane Corp", sar.SubjectName)
	}
	if sar.ActivityType != domain.ActivityStructuring {
		t.Errorf("activity=%s, want structuring", sar.ActivityType)
	}
	if sar.FilingStatus != domain.SARDraft {
		t.Errorf("status=%s, want draft", sar.FilingStatus)
	}
	if sar.RegulatoryBody != domain.RegulatorFinCEN {
		t.Errorf("regulator=%s, want FinCEN", sar.RegulatoryBody)
	}
	if sar.TotalAmount != 5000000 {
		t.Errorf("amount=%d, want 5000000", sar.TotalAmount)
	}
}

func TestGenerateSAR_InvalidTenant(t *testing.T) {
	gen := NewSARGenerator(&mockAI{response: "test"})
	ev := CaseEvidence{CaseID: "case_1", SubjectName: "Test"}
	_, err := gen.GenerateSAR(
		context.Background(), domain.TenantID{}, ev, domain.RegulatorFCA,
	)
	if err == nil {
		t.Error("expected error for zero tenant")
	}
}
