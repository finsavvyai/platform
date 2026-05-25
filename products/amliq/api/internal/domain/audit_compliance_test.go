package domain

import "testing"

func TestComplianceAuditString(t *testing.T) {
	tests := []struct {
		name   string
		action AuditAction
		want   string
	}{
		{"case created", AuditActionCaseCreated, "CaseCreated"},
		{"case assigned", AuditActionCaseAssigned, "CaseAssigned"},
		{"case escalated", AuditActionCaseEscalated, "CaseEscalated"},
		{"case resolved", AuditActionCaseResolved, "CaseResolved"},
		{"case commented", AuditActionCaseCommented, "CaseCommented"},
		{"monitor created", AuditActionMonitorCreated, "MonitorCreated"},
		{"monitor screened", AuditActionMonitorScreened, "MonitorScreened"},
		{"risk calculated", AuditActionRiskCalculated, "RiskCalculated"},
		{"ubo added", AuditActionUBOAdded, "UBOAdded"},
		{"ubo verified", AuditActionUBOVerified, "UBOVerified"},
		{"edd initiated", AuditActionEDDInitiated, "EDDInitiated"},
		{"edd completed", AuditActionEDDCompleted, "EDDCompleted"},
		{"pep screened", AuditActionPEPScreened, "PEPScreened"},
		{"media hit", AuditActionMediaHitFound, "MediaHitFound"},
		{"txn alert", AuditActionTxnAlertRaised, "TxnAlertRaised"},
		{"match config", AuditActionMatchConfigUpdated, "MatchConfigUpdated"},
		{"tenant suspended", AuditActionTenantSuspended, "TenantSuspended"},
		{"tenant activated", AuditActionTenantActivated, "TenantActivated"},
		{"api key revoked", AuditActionAPIKeyRevoked, "APIKeyRevoked"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := complianceAuditString(tt.action)
			if got != tt.want {
				t.Errorf("complianceAuditString(%d) = %s, want %s", tt.action, got, tt.want)
			}
		})
	}
}
