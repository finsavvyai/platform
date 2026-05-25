package domain

import (
	"fmt"
	"time"
)

// MonitorAlertType categorizes monitoring alert triggers.
type MonitorAlertType string

const (
	AlertNewMatch     MonitorAlertType = "new_match"
	AlertStatusChange MonitorAlertType = "status_change"
	AlertListUpdate   MonitorAlertType = "list_update"
	AlertRiskChange   MonitorAlertType = "risk_change"
	AlertMatchRemoved MonitorAlertType = "match_removed"
	AlertScoreChange  MonitorAlertType = "score_change"
)

// MonitorAlertSeverity indicates urgency.
type MonitorAlertSeverity string

const (
	SeverityCritical MonitorAlertSeverity = "critical"
	SeverityHigh     MonitorAlertSeverity = "high"
	SeverityMedium   MonitorAlertSeverity = "medium"
	SeverityLow      MonitorAlertSeverity = "low"
)

// MonitorAlert represents a change detected during ongoing monitoring.
type MonitorAlert struct {
	ID             string
	ProfileID      string
	TenantID       TenantID
	AlertType      MonitorAlertType
	MatchScore     float64
	MatchedEntity  string
	PreviousScore  float64
	Severity       MonitorAlertSeverity
	ReviewedBy     string
	ReviewedAt     *time.Time
	Disposition    string
	CreatedAt      time.Time
}

// NewMonitorAlert creates a monitoring alert.
func NewMonitorAlert(
	profileID string, tenantID TenantID,
	alertType MonitorAlertType, severity MonitorAlertSeverity,
) (MonitorAlert, error) {
	if profileID == "" || tenantID.IsZero() {
		return MonitorAlert{}, fmt.Errorf("profile id and tenant required")
	}
	now := time.Now().UTC()
	return MonitorAlert{
		ID:        fmt.Sprintf("mal_%d", now.UnixNano()),
		ProfileID: profileID,
		TenantID:  tenantID,
		AlertType: alertType,
		Severity:  severity,
		CreatedAt: now,
	}, nil
}

// Review marks the alert as reviewed.
func (ma MonitorAlert) Review(by, disposition string) MonitorAlert {
	now := time.Now().UTC()
	ma.ReviewedBy = by
	ma.ReviewedAt = &now
	ma.Disposition = disposition
	return ma
}

// IsReviewed returns true if the alert has been reviewed.
func (ma MonitorAlert) IsReviewed() bool {
	return ma.ReviewedAt != nil
}

// SeverityFromScore derives severity from a confidence score.
func SeverityFromScore(score float64) MonitorAlertSeverity {
	switch {
	case score >= 0.95:
		return SeverityCritical
	case score >= 0.80:
		return SeverityHigh
	case score >= 0.50:
		return SeverityMedium
	default:
		return SeverityLow
	}
}
