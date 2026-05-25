package domain

import (
	"fmt"
	"time"
)

// CaseStatus represents workflow states for compliance cases.
type CaseStatus string

const (
	CaseOpen      CaseStatus = "open"
	CaseInReview  CaseStatus = "in_review"
	CaseEscalated CaseStatus = "escalated"
	CaseResolved  CaseStatus = "resolved"
	CaseFalsePos  CaseStatus = "false_positive"
	CaseTrueMatch CaseStatus = "true_match"
	CaseArchived  CaseStatus = "archived"
)

// CasePriority indicates urgency.
type CasePriority string

const (
	PriorityCritical CasePriority = "critical"
	PriorityHigh     CasePriority = "high"
	PriorityMedium   CasePriority = "medium"
	PriorityLow      CasePriority = "low"
)

// ComplianceCase is a screening match that requires investigation.
type ComplianceCase struct {
	ID          string
	TenantID    TenantID
	ScreeningID string
	EntityName  string
	MatchedName string
	ListID      string
	Confidence  float64
	Status      CaseStatus
	Priority    CasePriority
	AssignedTo  string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	ResolvedAt  *time.Time
	ResolvedBy  string
	Resolution  string
}

func NewComplianceCase(
	tenantID TenantID, screeningID, entityName, matchedName, listID string,
	confidence float64,
) (ComplianceCase, error) {
	if tenantID.IsZero() || screeningID == "" {
		return ComplianceCase{}, fmt.Errorf("tenant and screening required")
	}
	now := time.Now().UTC()
	priority := classifyPriority(confidence)
	return ComplianceCase{
		ID:          fmt.Sprintf("case_%d", now.UnixNano()),
		TenantID:    tenantID,
		ScreeningID: screeningID,
		EntityName:  entityName,
		MatchedName: matchedName,
		ListID:      listID,
		Confidence:  confidence,
		Status:      CaseOpen,
		Priority:    priority,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func classifyPriority(confidence float64) CasePriority {
	switch {
	case confidence >= 0.95:
		return PriorityCritical
	case confidence >= 0.85:
		return PriorityHigh
	case confidence >= 0.70:
		return PriorityMedium
	default:
		return PriorityLow
	}
}
