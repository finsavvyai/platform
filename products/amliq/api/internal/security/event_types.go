package security

import (
	"fmt"
	"time"
)

type EventType string

const (
	EventFailedLogin        EventType = "FAILED_LOGIN"
	EventPermissionChange   EventType = "PERMISSION_CHANGE"
	EventDataExport         EventType = "DATA_EXPORT"
	EventUnauthorizedAccess EventType = "UNAUTHORIZED_ACCESS"
	EventBulkDataRetrieval  EventType = "BULK_DATA_RETRIEVAL"
	EventConfigChange       EventType = "CONFIG_CHANGE"
)

type Severity string

const (
	SeverityLow      Severity = "LOW"
	SeverityMedium   Severity = "MEDIUM"
	SeverityHigh     Severity = "HIGH"
	SeverityCritical Severity = "CRITICAL"
)

type SecurityEvent struct {
	ID        string
	Timestamp time.Time
	EventType EventType
	ActorID   string
	TenantID  string
	Severity  Severity
	Details   map[string]interface{}
}

func NewSecurityEvent(
	eventType EventType,
	actorID string,
	tenantID string,
	severity Severity,
) (SecurityEvent, error) {
	if actorID == "" || tenantID == "" {
		return SecurityEvent{}, fmt.Errorf("actor id and tenant id required")
	}
	return SecurityEvent{
		ID:        "evt_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		Timestamp: time.Now().UTC(),
		EventType: eventType,
		ActorID:   actorID,
		TenantID:  tenantID,
		Severity:  severity,
		Details:   make(map[string]interface{}),
	}, nil
}

type EventMetrics struct {
	TotalEvents      int64
	EventsByType     map[EventType]int64
	EventsBySeverity map[Severity]int64
	LastEventTime    time.Time
	AnomalyCount     int64
}

type TenantMetrics struct {
	EventCounts    map[EventType]int
	LastEventTimes map[EventType]time.Time
	BaselineRate   float64
	CurrentRate    float64
	Window         time.Duration
	LastCheck      time.Time
}
