package domain

import (
	"testing"
	"time"
)

func TestNewComplianceReport(t *testing.T) {
	tid, _ := NewTenantID("tnt_abcdefghijkl")
	now := time.Now()
	tests := []struct {
		name    string
		tenant  TenantID
		rptType ComplianceReportType
		from    time.Time
		to      time.Time
		wantErr bool
	}{
		{"valid report", tid, ReportSAR, now.AddDate(0, -1, 0), now, false},
		{"audit report", tid, ReportAudit, now.AddDate(0, -3, 0), now, false},
		{"zero tenant", TenantID{}, ReportSAR, now.AddDate(0, -1, 0), now, true},
		{"to before from", tid, ReportSTR, now, now.AddDate(0, -1, 0), true},
		{"ctr report", tid, ReportCTR, now.AddDate(-1, 0, 0), now, false},
		{"custom report", tid, ReportCustom, now.AddDate(0, 0, -7), now, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rpt, err := NewComplianceReport(
				tt.tenant, tt.rptType, tt.from, tt.to,
				ReportSummary{TotalScreenings: 10},
			)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if rpt.Type != tt.rptType {
				t.Errorf("type = %s, want %s", rpt.Type, tt.rptType)
			}
		})
	}
}
