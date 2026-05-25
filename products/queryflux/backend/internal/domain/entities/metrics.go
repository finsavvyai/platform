package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// DatabaseMetrics represents database performance metrics
type DatabaseMetrics struct {
	ID                string    `json:"id" db:"id"`
	ConnectionID      string    `json:"connection_id" db:"connection_id"`
	CPUUsage          float64   `json:"cpu_usage" db:"cpu_usage"`
	MemoryUsage       float64   `json:"memory_usage" db:"memory_usage"`
	ActiveConnections int       `json:"active_connections" db:"active_connections"`
	QueriesPerSecond  float64   `json:"queries_per_second" db:"queries_per_second"`
	AverageQueryTime  float64   `json:"avg_query_time" db:"avg_query_time"`
	DiskUsage         float64   `json:"disk_usage" db:"disk_usage"`
	Timestamp         time.Time `json:"timestamp" db:"timestamp"`
}

// Alert represents a database alert
type Alert struct {
	ID           string            `json:"id" db:"id"`
	UserID       string            `json:"user_id" db:"user_id"`
	ConnectionID string            `json:"connection_id" db:"connection_id"`
	Type         string            `json:"type" db:"type"`
	Severity     string            `json:"severity" db:"severity"`
	Message      string            `json:"message" db:"message"`
	Threshold    float64           `json:"threshold" db:"threshold"`
	CurrentValue float64           `json:"current_value" db:"current_value"`
	Status       string            `json:"status" db:"status"`
	Metadata     map[string]string `json:"metadata" db:"metadata"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
	ResolvedAt   *time.Time        `json:"resolved_at" db:"resolved_at"`
	MutedAt      *time.Time        `json:"muted_at" db:"muted_at"`
}

// Alert types
const (
	AlertTypeCPU         = "cpu_usage"
	AlertTypeMemory      = "memory_usage"
	AlertTypeDisk        = "disk_usage"
	AlertTypeConnections = "active_connections"
	AlertTypeQueryTime   = "query_time"
	AlertTypeError       = "error"
)

// Alert severities
const (
	SeverityLow      = "low"
	SeverityMedium   = "medium"
	SeverityHigh     = "high"
	SeverityCritical = "critical"
)

// Alert statuses
const (
	AlertStatusActive   = "active"
	AlertStatusResolved = "resolved"
	AlertStatusMuted    = "muted"
)

// NewDatabaseMetrics creates a new database metrics entry
func NewDatabaseMetrics(connectionID string) *DatabaseMetrics {
	return &DatabaseMetrics{
		ID:           uuid.New().String(),
		ConnectionID: connectionID,
		Timestamp:    time.Now(),
	}
}

// Validate validates the database metrics
func (dm *DatabaseMetrics) Validate() error {
	if dm.ConnectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	if dm.CPUUsage < 0 || dm.CPUUsage > 100 {
		return fmt.Errorf("CPU usage must be between 0 and 100")
	}

	if dm.MemoryUsage < 0 || dm.MemoryUsage > 100 {
		return fmt.Errorf("memory usage must be between 0 and 100")
	}

	if dm.DiskUsage < 0 || dm.DiskUsage > 100 {
		return fmt.Errorf("disk usage must be between 0 and 100")
	}

	if dm.ActiveConnections < 0 {
		return fmt.Errorf("active connections cannot be negative")
	}

	if dm.QueriesPerSecond < 0 {
		return fmt.Errorf("queries per second cannot be negative")
	}

	if dm.AverageQueryTime < 0 {
		return fmt.Errorf("average query time cannot be negative")
	}

	return nil
}

// SetCPUUsage sets the CPU usage percentage
func (dm *DatabaseMetrics) SetCPUUsage(usage float64) error {
	if usage < 0 || usage > 100 {
		return fmt.Errorf("CPU usage must be between 0 and 100")
	}
	dm.CPUUsage = usage
	return nil
}

// SetMemoryUsage sets the memory usage percentage
func (dm *DatabaseMetrics) SetMemoryUsage(usage float64) error {
	if usage < 0 || usage > 100 {
		return fmt.Errorf("memory usage must be between 0 and 100")
	}
	dm.MemoryUsage = usage
	return nil
}

// SetDiskUsage sets the disk usage percentage
func (dm *DatabaseMetrics) SetDiskUsage(usage float64) error {
	if usage < 0 || usage > 100 {
		return fmt.Errorf("disk usage must be between 0 and 100")
	}
	dm.DiskUsage = usage
	return nil
}

// SetActiveConnections sets the number of active connections
func (dm *DatabaseMetrics) SetActiveConnections(count int) error {
	if count < 0 {
		return fmt.Errorf("active connections cannot be negative")
	}
	dm.ActiveConnections = count
	return nil
}

// SetQueriesPerSecond sets the queries per second rate
func (dm *DatabaseMetrics) SetQueriesPerSecond(qps float64) error {
	if qps < 0 {
		return fmt.Errorf("queries per second cannot be negative")
	}
	dm.QueriesPerSecond = qps
	return nil
}

// SetAverageQueryTime sets the average query execution time in milliseconds
func (dm *DatabaseMetrics) SetAverageQueryTime(avgTime float64) error {
	if avgTime < 0 {
		return fmt.Errorf("average query time cannot be negative")
	}
	dm.AverageQueryTime = avgTime
	return nil
}

// NewAlert creates a new alert
func NewAlert(userID, connectionID, alertType, severity, message string, threshold, currentValue float64) (*Alert, error) {
	if err := validateAlertParams(userID, connectionID, alertType, severity, message); err != nil {
		return nil, err
	}

	return &Alert{
		ID:           uuid.New().String(),
		UserID:       userID,
		ConnectionID: connectionID,
		Type:         alertType,
		Severity:     severity,
		Message:      message,
		Threshold:    threshold,
		CurrentValue: currentValue,
		Status:       AlertStatusActive,
		Metadata:     make(map[string]string),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}, nil
}

// Validate validates the alert
func (a *Alert) Validate() error {
	return validateAlertParams(a.UserID, a.ConnectionID, a.Type, a.Severity, a.Message)
}

// Resolve marks the alert as resolved
func (a *Alert) Resolve() {
	a.Status = AlertStatusResolved
	now := time.Now()
	a.ResolvedAt = &now
	a.UpdatedAt = now
}

// Mute marks the alert as muted
func (a *Alert) Mute() {
	a.Status = AlertStatusMuted
	now := time.Now()
	a.MutedAt = &now
	a.UpdatedAt = now
}

// Reactivate marks the alert as active again
func (a *Alert) Reactivate() {
	a.Status = AlertStatusActive
	a.ResolvedAt = nil
	a.MutedAt = nil
	a.UpdatedAt = time.Now()
}

// SetMetadata sets metadata for the alert
func (a *Alert) SetMetadata(key, value string) {
	if a.Metadata == nil {
		a.Metadata = make(map[string]string)
	}
	a.Metadata[key] = value
}

// IsActive checks if the alert is currently active
func (a *Alert) IsActive() bool {
	return a.Status == AlertStatusActive
}

// IsResolved checks if the alert has been resolved
func (a *Alert) IsResolved() bool {
	return a.Status == AlertStatusResolved
}

// IsMuted checks if the alert is muted
func (a *Alert) IsMuted() bool {
	return a.Status == AlertStatusMuted
}

// GetSeverityLevel returns numeric severity level for comparison
func (a *Alert) GetSeverityLevel() int {
	switch a.Severity {
	case SeverityLow:
		return 1
	case SeverityMedium:
		return 2
	case SeverityHigh:
		return 3
	case SeverityCritical:
		return 4
	default:
		return 0
	}
}

// GetDurationSinceCreated returns the duration since the alert was created
func (a *Alert) GetDurationSinceCreated() time.Duration {
	return time.Since(a.CreatedAt)
}

// GetDurationUntilResolved returns the duration until the alert was resolved
func (a *Alert) GetDurationUntilResolved() *time.Duration {
	if a.ResolvedAt == nil {
		return nil
	}
	duration := a.ResolvedAt.Sub(a.CreatedAt)
	return &duration
}

// Validation helpers
func validateAlertParams(userID, connectionID, alertType, severity, message string) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}

	if connectionID == "" {
		return fmt.Errorf("connection ID is required")
	}

	if !isValidAlertType(alertType) {
		return fmt.Errorf("invalid alert type: %s", alertType)
	}

	if !isValidSeverity(severity) {
		return fmt.Errorf("invalid severity: %s", severity)
	}

	if message == "" {
		return fmt.Errorf("alert message is required")
	}

	if len(message) > 1000 {
		return fmt.Errorf("alert message must be less than 1000 characters")
	}

	return nil
}

func isValidAlertType(alertType string) bool {
	validTypes := []string{
		AlertTypeCPU,
		AlertTypeMemory,
		AlertTypeDisk,
		AlertTypeConnections,
		AlertTypeQueryTime,
		AlertTypeError,
	}

	for _, validType := range validTypes {
		if alertType == validType {
			return true
		}
	}

	return false
}

func isValidSeverity(severity string) bool {
	validSeverities := []string{
		SeverityLow,
		SeverityMedium,
		SeverityHigh,
		SeverityCritical,
	}

	for _, validSeverity := range validSeverities {
		if severity == validSeverity {
			return true
		}
	}

	return false
}
