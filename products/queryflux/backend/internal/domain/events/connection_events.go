package events

import (
	"time"
)

// ConnectionEventType defines connection event types
const (
	ConnectionCreated      = "connection.created"
	ConnectionUpdated      = "connection.updated"
	ConnectionDeleted      = "connection.deleted"
	ConnectionConnected    = "connection.connected"
	ConnectionDisconnected = "connection.disconnected"
	ConnectionTested       = "connection.tested"
	ConnectionFailed       = "connection.failed"
	ConnectionRotated      = "connection.credentials_rotated"
)

// ConnectionCreatedEvent represents a connection creation event
type ConnectionCreatedEvent struct {
	*BaseEvent
	UserID      string            `json:"user_id"`
	Name        string            `json:"name"`
	Type        string            `json:"type"`
	Host        string            `json:"host"`
	Port        int               `json:"port"`
	Database    string            `json:"database"`
	Username    string            `json:"username"`
	SSL         bool              `json:"ssl"`
	Options     map[string]string `json:"options"`
	TenantID    string            `json:"tenant_id,omitempty"`
}

// NewConnectionCreatedEvent creates a new connection created event
func NewConnectionCreatedEvent(aggregateID, userID, name, connType, host string, port int, database, username string, ssl bool, options map[string]string) *ConnectionCreatedEvent {
	event := &ConnectionCreatedEvent{
		BaseEvent: NewBaseEvent(aggregateID, "connection", ConnectionCreated, 1, nil),
		UserID:    userID,
		Name:      name,
		Type:      connType,
		Host:      host,
		Port:      port,
		Database:  database,
		Username:  username,
		SSL:       ssl,
		Options:   options,
	}
	event.data = event
	return event
}

// ConnectionConnectedEvent represents a successful connection event
type ConnectionConnectedEvent struct {
	*BaseEvent
	UserID          string            `json:"user_id"`
	ConnectionID    string            `json:"connection_id"`
	DatabaseType    string            `json:"database_type"`
	DatabaseVersion string            `json:"database_version,omitempty"`
	ConnectedAt     time.Time         `json:"connected_at"`
	Duration        time.Duration     `json:"duration"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// NewConnectionConnectedEvent creates a new connection connected event
func NewConnectionConnectedEvent(aggregateID, userID, connectionID, databaseType, databaseVersion string, duration time.Duration) *ConnectionConnectedEvent {
	event := &ConnectionConnectedEvent{
		BaseEvent:       NewBaseEvent(aggregateID, "connection", ConnectionConnected, 0, nil),
		UserID:          userID,
		ConnectionID:    connectionID,
		DatabaseType:    databaseType,
		DatabaseVersion: databaseVersion,
		ConnectedAt:     time.Now().UTC(),
		Duration:        duration,
		Metadata:        make(map[string]string),
	}
	event.data = event
	return event
}

// ConnectionQueryExecutedEvent represents a query execution event
type ConnectionQueryExecutedEvent struct {
	*BaseEvent
	UserID       string        `json:"user_id"`
	ConnectionID string        `json:"connection_id"`
	QueryID      string        `json:"query_id"`
	Query        string        `json:"query"`
	QueryType    string        `json:"query_type"` // SELECT, INSERT, UPDATE, DELETE, DDL, etc.
	RowsAffected int           `json:"rows_affected"`
	Duration     time.Duration `json:"duration"`
	Success      bool          `json:"success"`
	ErrorMessage string        `json:"error_message,omitempty"`
	QueryHash    string        `json:"query_hash,omitempty"`
}

// NewConnectionQueryExecutedEvent creates a new query executed event
func NewConnectionQueryExecutedEvent(aggregateID, userID, connectionID, queryID, query, queryType string, rowsAffected int, duration time.Duration, success bool, errorMessage, queryHash string) *ConnectionQueryExecutedEvent {
	event := &ConnectionQueryExecutedEvent{
		BaseEvent:    NewBaseEvent(aggregateID, "connection", "connection.query_executed", 0, nil),
		UserID:       userID,
		ConnectionID: connectionID,
		QueryID:      queryID,
		Query:        query,
		QueryType:    queryType,
		RowsAffected: rowsAffected,
		Duration:     duration,
		Success:      success,
		ErrorMessage: errorMessage,
		QueryHash:    queryHash,
	}
	event.data = event
	return event
}

// ConnectionSecurityEvent represents a security-related event
type ConnectionSecurityEvent struct {
	*BaseEvent
	UserID          string            `json:"user_id"`
	ConnectionID    string            `json:"connection_id"`
	SecurityAction  string            `json:"security_action"` // LOGIN, LOGOUT, FAILED_LOGIN, ACCESS_DENIED, etc.
	IPAddress       string            `json:"ip_address"`
	UserAgent       string            `json:"user_agent"`
	Success         bool              `json:"success"`
	FailureReason   string            `json:"failure_reason,omitempty"`
	RiskScore       float64           `json:"risk_score"`
	ThreatDetected  bool              `json:"threat_detected"`
	ThreatType      string            `json:"threat_type,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// NewConnectionSecurityEvent creates a new security event
func NewConnectionSecurityEvent(aggregateID, userID, connectionID, securityAction, ipAddress, userAgent string, success bool, failureReason string, riskScore float64) *ConnectionSecurityEvent {
	event := &ConnectionSecurityEvent{
		BaseEvent:     NewBaseEvent(aggregateID, "connection", "connection.security", 0, nil),
		UserID:        userID,
		ConnectionID:  connectionID,
		SecurityAction: securityAction,
		IPAddress:     ipAddress,
		UserAgent:     userAgent,
		Success:       success,
		FailureReason: failureReason,
		RiskScore:     riskScore,
		ThreatDetected: riskScore > 0.8,
		Metadata:      make(map[string]string),
	}
	event.data = event
	return event
}

// ConnectionMetricsEvent represents a metrics collection event
type ConnectionMetricsEvent struct {
	*BaseEvent
	ConnectionID      string                 `json:"connection_id"`
	MetricsType       string                 `json:"metrics_type"` // PERFORMANCE, HEALTH, USAGE, etc.
	Metrics           map[string]interface{} `json:"metrics"`
	Timestamp         time.Time              `json:"timestamp"`
	CollectionPeriod  time.Duration          `json:"collection_period"`
	AggregatedMetrics map[string]interface{} `json:"aggregated_metrics,omitempty"`
}

// NewConnectionMetricsEvent creates a new metrics event
func NewConnectionMetricsEvent(aggregateID, connectionID, metricsType string, metrics map[string]interface{}, collectionPeriod time.Duration) *ConnectionMetricsEvent {
	event := &ConnectionMetricsEvent{
		BaseEvent:        NewBaseEvent(aggregateID, "connection", "connection.metrics", 0, nil),
		ConnectionID:     connectionID,
		MetricsType:      metricsType,
		Metrics:          metrics,
		Timestamp:        time.Now().UTC(),
		CollectionPeriod: collectionPeriod,
		AggregatedMetrics: make(map[string]interface{}),
	}
	event.data = event
	return event
}