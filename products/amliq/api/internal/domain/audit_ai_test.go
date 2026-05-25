package domain

import "testing"

func TestAIAuditString(t *testing.T) {
	tests := []struct {
		name   string
		action AuditAction
		want   string
	}{
		{"ai summarized", AuditActionAISummarized, "AISummarized"},
		{"unknown returns empty", AuditActionUnknown, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := aiAuditString(tt.action); got != tt.want {
				t.Errorf("aiAuditString(%d) = %q, want %q",
					tt.action, got, tt.want)
			}
		})
	}
}
