package domain

import (
	"fmt"
	"time"
)

// SARActivityType classifies the suspicious activity.
type SARActivityType string

const (
	ActivityStructuring        SARActivityType = "structuring"
	ActivityMoneyLaundering    SARActivityType = "money_laundering"
	ActivityTerroristFinancing SARActivityType = "terrorist_financing"
	ActivityFraud              SARActivityType = "fraud"
	ActivityIdentityTheft      SARActivityType = "identity_theft"
)

// SARFilingStatus tracks the lifecycle of a SAR.
type SARFilingStatus string

const (
	SARDraft        SARFilingStatus = "draft"
	SARReview       SARFilingStatus = "review"
	SARFiled        SARFilingStatus = "filed"
	SARAcknowledged SARFilingStatus = "acknowledged"
)

// RegulatoryBody identifies the target regulator.
type RegulatoryBody string

const (
	RegulatorFinCEN RegulatoryBody = "FinCEN"
	RegulatorFCA    RegulatoryBody = "FCA"
	RegulatorMAS    RegulatoryBody = "MAS"
)

// SAR represents a Suspicious Activity Report.
type SAR struct {
	ID               string
	TenantID         TenantID
	CaseID           string
	SubjectName      string
	SubjectType      string
	ActivityType     SARActivityType
	DateRangeFrom    time.Time
	DateRangeTo      time.Time
	NarrativeSummary string
	TotalAmount      int64
	FilingStatus     SARFilingStatus
	FiledAt          time.Time
	RegulatoryBody   RegulatoryBody
	ReferenceNumber  string
	CreatedAt        time.Time
}

// NewSAR creates a draft SAR for a case.
func NewSAR(
	tenantID TenantID, caseID, subject string,
	activityType SARActivityType,
) (SAR, error) {
	if tenantID.IsZero() {
		return SAR{}, fmt.Errorf("tenant required")
	}
	if caseID == "" || subject == "" {
		return SAR{}, fmt.Errorf("case ID and subject required")
	}
	return SAR{
		ID:           fmt.Sprintf("sar_%d", time.Now().UnixNano()),
		TenantID:     tenantID,
		CaseID:       caseID,
		SubjectName:  subject,
		ActivityType: activityType,
		FilingStatus: SARDraft,
		CreatedAt:    time.Now().UTC(),
	}, nil
}

// CanTransition validates SAR status transitions.
func (s SAR) CanTransition(to SARFilingStatus) bool {
	valid := map[SARFilingStatus][]SARFilingStatus{
		SARDraft: {SARReview}, SARReview: {SARDraft, SARFiled}, SARFiled: {SARAcknowledged},
	}
	for _, a := range valid[s.FilingStatus] {
		if a == to {
			return true
		}
	}
	return false
}

// ValidActivityType checks if an activity type is valid.
func ValidActivityType(at SARActivityType) bool {
	switch at {
	case ActivityStructuring, ActivityMoneyLaundering,
		ActivityTerroristFinancing, ActivityFraud, ActivityIdentityTheft:
		return true
	}
	return false
}
