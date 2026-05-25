package domain

// Compliance-specific audit actions.
const (
	AuditActionCaseCreated AuditAction = iota + 100
	AuditActionCaseAssigned
	AuditActionCaseEscalated
	AuditActionCaseResolved
	AuditActionCaseCommented
	AuditActionMonitorCreated
	AuditActionMonitorScreened
	AuditActionRiskCalculated
	AuditActionUBOAdded
	AuditActionUBOVerified
	AuditActionEDDInitiated
	AuditActionEDDCompleted
	AuditActionPEPScreened
	AuditActionMediaHitFound
	AuditActionTxnAlertRaised
	AuditActionMatchConfigUpdated
	AuditActionTenantSuspended
	AuditActionTenantActivated
	AuditActionAPIKeyRevoked
)

func complianceAuditString(aa AuditAction) string {
	m := map[AuditAction]string{
		AuditActionCaseCreated:        "CaseCreated",
		AuditActionCaseAssigned:       "CaseAssigned",
		AuditActionCaseEscalated:      "CaseEscalated",
		AuditActionCaseResolved:       "CaseResolved",
		AuditActionCaseCommented:      "CaseCommented",
		AuditActionMonitorCreated:     "MonitorCreated",
		AuditActionMonitorScreened:    "MonitorScreened",
		AuditActionRiskCalculated:     "RiskCalculated",
		AuditActionUBOAdded:           "UBOAdded",
		AuditActionUBOVerified:        "UBOVerified",
		AuditActionEDDInitiated:       "EDDInitiated",
		AuditActionEDDCompleted:       "EDDCompleted",
		AuditActionPEPScreened:        "PEPScreened",
		AuditActionMediaHitFound:      "MediaHitFound",
		AuditActionTxnAlertRaised:     "TxnAlertRaised",
		AuditActionMatchConfigUpdated: "MatchConfigUpdated",
		AuditActionTenantSuspended:    "TenantSuspended",
		AuditActionTenantActivated:    "TenantActivated",
		AuditActionAPIKeyRevoked:      "APIKeyRevoked",
	}
	return m[aa]
}
