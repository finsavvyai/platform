package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Deployment represents a deployed MCP connector
type Deployment struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID uuid.UUID  `gorm:"type:uuid;not null;index" json:"connector_id"`
	Environment string     `gorm:"not null" json:"environment"`
	Platform    string     `gorm:"not null" json:"platform"`
	Runtime     string     `gorm:"not null" json:"runtime"`
	URL         string     `gorm:"not null" json:"url"`
	Status      string     `gorm:"not null" json:"status"`
	Version     string     `gorm:"not null" json:"version"`
	Config      ConfigData `gorm:"type:jsonb" json:"config"`
	Metadata    string     `gorm:"type:jsonb" json:"metadata"`
	Error       *string    `json:"error,omitempty"`
	DeployedAt  *time.Time `json:"deployed_at,omitempty"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Connector      *Connector      `gorm:"foreignKey:ConnectorID" json:"connector,omitempty"`
	DeploymentLogs []DeploymentLog `gorm:"foreignKey:DeploymentID" json:"deployment_logs,omitempty"`
}

// DeploymentLog represents a log entry for deployment operations
type DeploymentLog struct {
	ID           uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"connector_id"`
	DeploymentID *uuid.UUID `gorm:"type:uuid;index" json:"deployment_id,omitempty"`
	Level        string     `gorm:"not null;default:'info'" json:"level"` // debug, info, warn, error
	Message      string     `gorm:"not null;type:text" json:"message"`
	Context      string     `gorm:"type:jsonb" json:"context"`               // Additional context data
	Source       string     `gorm:"not null;default:'system'" json:"source"` // system, worker, agentkit
	CreatedAt    time.Time  `json:"created_at"`
}

// WorkerStatus represents the current status of a deployed worker
type WorkerStatus struct {
	ConnectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"connector_id"`
	WorkerID    string    `gorm:"not null;index" json:"worker_id"`
	URL         string    `gorm:"not null" json:"url"`
	Environment string    `gorm:"not null" json:"environment"`
	Status      string    `gorm:"not null" json:"status"` // healthy, unhealthy, unknown
	LastChecked time.Time `json:"last_checked"`
	Metrics     string    `gorm:"type:jsonb" json:"metrics"` // Performance metrics
}

// DeploymentMetrics represents deployment performance metrics
type DeploymentMetrics struct {
	ID                   uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID          uuid.UUID `gorm:"type:uuid;not null;index" json:"connector_id"`
	DeploymentID         uuid.UUID `gorm:"type:uuid;not null;index" json:"deployment_id"`
	Date                 time.Time `gorm:"not null;index" json:"date"`
	RequestCount         int       `gorm:"default:0" json:"request_count"`
	SuccessCount         int       `gorm:"default:0" json:"success_count"`
	ErrorCount           int       `gorm:"default:0" json:"error_count"`
	AverageResponseTime  float64   `gorm:"default:0" json:"average_response_time"`
	P95ResponseTime      float64   `gorm:"default:0" json:"p95_response_time"`
	P99ResponseTime      float64   `gorm:"default:0" json:"p99_response_time"`
	AgentKitInvocations  int       `gorm:"default:0" json:"agentkit_invocations"`
	AgentKitErrors       int       `gorm:"default:0" json:"agentkit_errors"`
	AgentKitResponseTime float64   `gorm:"default:0" json:"agentkit_response_time"`
	CPUUsage             float64   `gorm:"default:0" json:"cpu_usage"`
	MemoryUsage          float64   `gorm:"default:0" json:"memory_usage"`
	DatabaseConnections  int       `gorm:"default:0" json:"database_connections"`
	CacheHitRate         float64   `gorm:"default:0" json:"cache_hit_rate"`
	CustomMetrics        string    `gorm:"type:jsonb" json:"custom_metrics"`

	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relationships
	Connector *Connector `gorm:"foreignKey:ConnectorID" json:"connector,omitempty"`
}

// DeploymentEvent represents deployment events
type DeploymentEvent struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID  uuid.UUID `gorm:"type:uuid;not null;index" json:"connector_id"`
	DeploymentID uuid.UUID `gorm:"type:uuid;not null;index" json:"deployment_id"`
	EventType    string    `gorm:"not null" json:"event_type"` // deploy, update, rollback, delete, error
	Status       string    `gorm:"not null" json:"status"`     // started, completed, failed
	Message      string    `gorm:"not null;type:text" json:"message"`
	Details      string    `gorm:"type:jsonb" json:"details"`      // Additional event details
	UserID       uuid.UUID `gorm:"type:uuid;index" json:"user_id"` // User who triggered event
	CreatedAt    time.Time `json:"created_at"`
}

// TableName methods
func (Deployment) TableName() string {
	return "deployments"
}

func (DeploymentLog) TableName() string {
	return "deployment_logs"
}

func (WorkerStatus) TableName() string {
	return "worker_status"
}

func (DeploymentMetrics) TableName() string {
	return "deployment_metrics"
}

func (DeploymentEvent) TableName() string {
	return "deployment_events"
}

// Helper methods for DeploymentMetrics
func (dm *DeploymentMetrics) GetSuccessRate() float64 {
	if dm.RequestCount == 0 {
		return 0.0
	}
	return float64(dm.SuccessCount) / float64(dm.RequestCount) * 100
}

func (dm *DeploymentMetrics) GetErrorRate() float64 {
	if dm.RequestCount == 0 {
		return 0.0
	}
	return float64(dm.ErrorCount) / float64(dm.RequestCount) * 100
}

func (dm *DeploymentMetrics) GetAgentKitSuccessRate() float64 {
	if dm.AgentKitInvocations == 0 {
		return 100.0 // No invocations means 100% success by default
	}
	return float64(dm.AgentKitInvocations-dm.AgentKitErrors) / float64(dm.AgentKitInvocations) * 100
}

// BeforeCreate hooks
func (d *Deployment) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

func (dl *DeploymentLog) BeforeCreate(tx *gorm.DB) error {
	if dl.ID == uuid.Nil {
		dl.ID = uuid.New()
	}
	return nil
}

func (de *DeploymentEvent) BeforeCreate(tx *gorm.DB) error {
	if de.ID == uuid.Nil {
		de.ID = uuid.New()
	}
	return nil
}

func (dm *DeploymentMetrics) BeforeCreate(tx *gorm.DB) error {
	if dm.ID == uuid.Nil {
		dm.ID = uuid.New()
	}
	return nil
}
