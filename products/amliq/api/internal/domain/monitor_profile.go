package domain

import (
	"fmt"
	"time"
)

// MonitorFrequency controls re-screening cadence.
type MonitorFrequency string

const (
	FreqRealtime MonitorFrequency = "realtime"
	FreqDaily    MonitorFrequency = "daily"
	FreqWeekly   MonitorFrequency = "weekly"
)

// MonitorProfile represents a perpetually monitored entity.
type MonitorProfile struct {
	ID             string
	TenantID       TenantID
	EntityName     string
	EntityType     EntityType
	RiskLevel      RiskLevel
	ListsToScreen  []string
	Frequency      MonitorFrequency
	Status         MonitorStatus
	LastScreenedAt *time.Time
	NextScreenAt   time.Time
	MatchCount     int
	CreatedAt      time.Time
}

// NewMonitorProfile constructs a validated profile.
func NewMonitorProfile(
	tenantID TenantID, name string, entType EntityType, risk RiskLevel,
) (MonitorProfile, error) {
	if tenantID.IsZero() {
		return MonitorProfile{}, fmt.Errorf("tenant id required")
	}
	if name == "" {
		return MonitorProfile{}, fmt.Errorf("entity name required")
	}
	if risk == "" {
		risk = RiskMedium
	}
	now := time.Now().UTC()
	return MonitorProfile{
		ID:            fmt.Sprintf("mpr_%d", now.UnixNano()),
		TenantID:      tenantID,
		EntityName:    name,
		EntityType:    entType,
		RiskLevel:     risk,
		ListsToScreen: []string{"OFAC", "EU", "UN"},
		Frequency:     FreqDaily,
		Status:        MonitorActive,
		NextScreenAt:  now.Add(24 * time.Hour),
		CreatedAt:     now,
	}, nil
}

// IsDue returns true if the profile should be re-screened.
func (mp MonitorProfile) IsDue(now time.Time) bool {
	return mp.Status == MonitorActive && !now.Before(mp.NextScreenAt)
}

// AdvanceSchedule sets next screen time based on frequency.
func (mp MonitorProfile) AdvanceSchedule(from time.Time) MonitorProfile {
	mp.LastScreenedAt = &from
	switch mp.Frequency {
	case FreqRealtime:
		mp.NextScreenAt = from.Add(5 * time.Minute)
	case FreqWeekly:
		mp.NextScreenAt = from.Add(7 * 24 * time.Hour)
	default:
		mp.NextScreenAt = from.Add(24 * time.Hour)
	}
	return mp
}

// Pause sets the profile status to paused.
func (mp MonitorProfile) Pause() MonitorProfile {
	mp.Status = MonitorPaused
	return mp
}

// Resume sets the profile status back to active.
func (mp MonitorProfile) Resume() MonitorProfile {
	mp.Status = MonitorActive
	return mp
}

// ParseFrequency validates a frequency string.
func ParseFrequency(s string) (MonitorFrequency, error) {
	switch MonitorFrequency(s) {
	case FreqRealtime, FreqDaily, FreqWeekly:
		return MonitorFrequency(s), nil
	default:
		return FreqDaily, fmt.Errorf("invalid frequency: %s", s)
	}
}
