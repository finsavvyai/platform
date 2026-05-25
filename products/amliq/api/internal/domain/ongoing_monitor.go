package domain

import (
	"fmt"
	"time"
)

// MonitorStatus tracks ongoing monitoring state.
type MonitorStatus string

const (
	MonitorActive  MonitorStatus = "active"
	MonitorPaused  MonitorStatus = "paused"
	MonitorExpired MonitorStatus = "expired"
)

// OngoingMonitor represents a continuously monitored entity.
type OngoingMonitor struct {
	ID           string
	TenantID     TenantID
	EntityName   string
	EntityType   EntityType
	Frequency    string // daily, weekly, monthly
	Status       MonitorStatus
	LastScreened *time.Time
	NextScreen   time.Time
	MatchCount   int
	CreatedAt    time.Time
}

func NewOngoingMonitor(
	tenantID TenantID, name string, entType EntityType, freq string,
) (OngoingMonitor, error) {
	if tenantID.IsZero() || name == "" {
		return OngoingMonitor{}, fmt.Errorf("tenant and name required")
	}
	if freq == "" {
		freq = "daily"
	}
	now := time.Now().UTC()
	return OngoingMonitor{
		ID:         fmt.Sprintf("mon_%d", now.UnixNano()),
		TenantID:   tenantID,
		EntityName: name,
		EntityType: entType,
		Frequency:  freq,
		Status:     MonitorActive,
		NextScreen: nextScreenTime(now, freq),
		CreatedAt:  now,
	}, nil
}

func nextScreenTime(from time.Time, freq string) time.Time {
	switch freq {
	case "daily":
		return from.Add(24 * time.Hour)
	case "weekly":
		return from.Add(7 * 24 * time.Hour)
	case "monthly":
		return from.AddDate(0, 1, 0)
	default:
		return from.Add(24 * time.Hour)
	}
}
