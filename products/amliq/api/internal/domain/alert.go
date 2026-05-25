package domain

import (
	"fmt"
	"time"
)

type Alert struct {
	ID            string
	TenantID      TenantID
	ScreeningID   string
	MatchResult   MatchResult
	Status        AlertStatus
	Priority      AlertPriority
	AssignedTo    string
	Resolution    string
	Justification string
	CreatedAt     time.Time
	UpdatedAt     time.Time
	ResolvedAt    *time.Time
}

func NewAlert(
	tenantID TenantID,
	screeningID string,
	matchResult MatchResult,
) (Alert, error) {
	if tenantID.IsZero() || screeningID == "" {
		return Alert{}, fmt.Errorf("tenant id and screening id required")
	}
	now := time.Now().UTC()
	return Alert{
		ID:          "alr_" + fmt.Sprintf("%d", now.UnixNano()),
		TenantID:    tenantID,
		ScreeningID: screeningID,
		MatchResult: matchResult,
		Status:      AlertStatusPending,
		Priority:    PriorityFromConfidence(matchResult.Confidence),
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (a Alert) Resolve(justification string) Alert {
	now := time.Now().UTC()
	a.Status = AlertStatusResolved
	a.Justification = justification
	a.ResolvedAt = &now
	a.UpdatedAt = now
	return a
}

func (a Alert) String() string {
	return fmt.Sprintf("Alert(%s, %s)", a.ID, a.Priority.String())
}
