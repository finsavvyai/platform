package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Agent struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID uuid.UUID `gorm:"type:uuid;not null;index" json:"connector_id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	Status      string    `gorm:"default:stopped" json:"status"` // running, stopped, error, paused
	Type        string    `json:"type"`                          // mcp_server, websocket, etc.
	Config      AgentConfig `gorm:"type:jsonb" json:"config"`

	// Runtime info
	PID        *int    `json:"pid,omitempty"`
	Endpoint   string  `json:"endpoint"`
	HealthCheckURL string `json:"health_check_url"`
	LastPing   *time.Time `json:"last_ping,omitempty"`

	// Metrics
	TotalRequests int64 `json:"total_requests"`
	ActiveRequests int64 `json:"active_requests"`
	ErrorCount    int64 `json:"error_count"`
	AvgLatency    float64 `json:"avg_latency"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Connector     Connector     `gorm:"foreignKey:ConnectorID" json:"connector,omitempty"`
	Analytics     []AgentAnalytics `gorm:"foreignKey:AgentID" json:"analytics,omitempty"`
	LogEntries    []AgentLog    `gorm:"foreignKey:AgentID" json:"log_entries,omitempty"`
}

type AgentConfig struct {
	Port            int               `json:"port"`
	Host            string            `json:"host"`
	Environment     map[string]string `json:"environment"`
	Resources       ResourceConfig    `json:"resources"`
	HealthCheck     HealthCheckConfig `json:"health_check"`
	AutoRestart     bool              `json:"auto_restart"`
	MaxMemoryMB     int               `json:"max_memory_mb"`
	MaxCPU          float64           `json:"max_cpu"`
}

type ResourceConfig struct {
	MemoryMB int     `json:"memory_mb"`
	CPU      float64 `json:"cpu"`
	DiskMB   int     `json:"disk_mb"`
	Network  string  `json:"network"`
}

type HealthCheckConfig struct {
	Enabled     bool   `json:"enabled"`
	Path        string `json:"path"`
	Interval    int    `json:"interval"`    // seconds
	Timeout     int    `json:"timeout"`     // seconds
	Retries     int    `json:"retries"`
	GracePeriod int    `json:"grace_period"` // seconds
}

func (a *Agent) TableName() string {
	return "agents"
}

func (a *Agent) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}