package domain

import (
	"fmt"
	"time"
)

// EDDStatus tracks Enhanced Due Diligence workflow.
type EDDStatus string

const (
	EDDInitiated  EDDStatus = "initiated"
	EDDInProgress EDDStatus = "in_progress"
	EDDCompleted  EDDStatus = "completed"
	EDDFailed     EDDStatus = "failed"
)

// EDDChecklist items that must be verified.
type EDDCheckItem string

const (
	EDDIdentityVerified   EDDCheckItem = "identity_verified"
	EDDSourceOfFunds      EDDCheckItem = "source_of_funds"
	EDDSourceOfWealth     EDDCheckItem = "source_of_wealth"
	EDDPEPScreening       EDDCheckItem = "pep_screening"
	EDDAdverseMedia       EDDCheckItem = "adverse_media_check"
	EDDSanctionsScreening EDDCheckItem = "sanctions_screening"
	EDDUBOVerification    EDDCheckItem = "ubo_verification"
	EDDCountryRiskAssess  EDDCheckItem = "country_risk_assessment"
	EDDTransactionHistory EDDCheckItem = "transaction_history_review"
)

// EDDReport is the full Enhanced Due Diligence record.
type EDDReport struct {
	ID          string
	TenantID    TenantID
	EntityID    string
	EntityName  string
	CaseID      string
	Status      EDDStatus
	Checklist   map[EDDCheckItem]bool
	RiskScore   float64
	RiskLevel   RiskLevel
	Analyst     string
	Notes       string
	StartedAt   time.Time
	CompletedAt *time.Time
}

func NewEDDReport(
	tenantID TenantID, entityID, entityName, caseID string,
) (EDDReport, error) {
	if tenantID.IsZero() || entityID == "" {
		return EDDReport{}, fmt.Errorf("tenant and entity required")
	}
	checklist := make(map[EDDCheckItem]bool)
	for _, item := range allEDDChecks() {
		checklist[item] = false
	}
	return EDDReport{
		ID:         fmt.Sprintf("edd_%d", time.Now().UnixNano()),
		TenantID:   tenantID,
		EntityID:   entityID,
		EntityName: entityName,
		CaseID:     caseID,
		Status:     EDDInitiated,
		Checklist:  checklist,
		StartedAt:  time.Now().UTC(),
	}, nil
}

func allEDDChecks() []EDDCheckItem {
	return []EDDCheckItem{
		EDDIdentityVerified, EDDSourceOfFunds, EDDSourceOfWealth,
		EDDPEPScreening, EDDAdverseMedia, EDDSanctionsScreening,
		EDDUBOVerification, EDDCountryRiskAssess,
	}
}
