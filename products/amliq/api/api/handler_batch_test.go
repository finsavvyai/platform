package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestNewBatchJob(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		count    int
		format   string
		wantErr  bool
		wantFmt  string
	}{
		{
			name:     "valid csv",
			tenantID: "tnt_abcdef123456",
			count:    10,
			format:   "csv",
			wantFmt:  "csv",
		},
		{
			name:     "default format",
			tenantID: "tnt_abcdef123456",
			count:    5,
			format:   "",
			wantFmt:  "csv",
		},
		{
			name:     "zero count",
			tenantID: "tnt_abcdef123456",
			count:    0,
			wantErr:  true,
		},
		{
			name:     "invalid tenant",
			tenantID: "bad",
			count:    10,
			wantErr:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, tidErr := domain.NewTenantID(tt.tenantID)
			if tidErr != nil && !tt.wantErr {
				t.Fatalf("bad tenant setup: %v", tidErr)
			}
			if tidErr != nil {
				return
			}
			job, err := domain.NewBatchJob(tid, tt.count, tt.format)
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected: %v", err)
			}
			if !tt.wantErr && job.Format != tt.wantFmt {
				t.Errorf("format = %q, want %q", job.Format, tt.wantFmt)
			}
		})
	}
}

func TestBatchJobLifecycle(t *testing.T) {
	tests := []struct {
		name   string
		action string
		want   domain.BatchStatus
	}{
		{"processing", "process", domain.BatchProcessing},
		{"completed", "complete", domain.BatchCompleted},
		{"failed", "fail", domain.BatchFailed},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, _ := domain.NewTenantID("tnt_abcdef123456")
			job, _ := domain.NewBatchJob(tid, 5, "csv")
			switch tt.action {
			case "process":
				job.MarkProcessing()
			case "complete":
				job.MarkCompleted(3)
			case "fail":
				job.MarkFailed("boom")
			}
			if job.Status != tt.want {
				t.Errorf("status = %q, want %q", job.Status, tt.want)
			}
		})
	}
}
