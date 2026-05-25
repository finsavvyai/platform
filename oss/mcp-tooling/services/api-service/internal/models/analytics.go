package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConnectorAnalytics tracks analytics for connectors
type ConnectorAnalytics struct {
	ID          uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID uuid.UUID         `gorm:"type:uuid;not null;index" json:"connector_id"`
	Timestamp   time.Time         `gorm:"index" json:"timestamp"`
	Metric      string            `gorm:"not null" json:"metric"` // requests, errors, latency, etc.
	Value       float64           `json:"value"`
	Labels      map[string]string `gorm:"type:jsonb" json:"labels"`
}

// AgentAnalytics tracks analytics for individual agents
type AgentAnalytics struct {
	ID        uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AgentID   uuid.UUID         `gorm:"type:uuid;not null;index" json:"agent_id"`
	Timestamp time.Time         `gorm:"index" json:"timestamp"`
	Metric    string            `gorm:"not null" json:"metric"`
	Value     float64           `json:"value"`
	Labels    map[string]string `gorm:"type:jsonb" json:"labels"`
}

// AgentLog tracks log entries for agents
type AgentLog struct {
	ID        uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AgentID   uuid.UUID              `gorm:"type:uuid;not null;index" json:"agent_id"`
	Timestamp time.Time              `gorm:"index" json:"timestamp"`
	Level     string                 `gorm:"not null" json:"level"` // debug, info, warn, error
	Message   string                 `gorm:"type:text" json:"message"`
	Context   map[string]interface{} `gorm:"type:jsonb" json:"context"`
}

// GenerationJob tracks code generation jobs
type GenerationJob struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConnectorID uuid.UUID  `gorm:"type:uuid;not null;index" json:"connector_id"`
	Status      string     `gorm:"default:pending" json:"status"` // pending, running, completed, failed
	Language    string     `json:"language"`
	Options     JobOptions `gorm:"type:jsonb" json:"options"`
	Result      *JobResult `gorm:"type:jsonb" json:"result,omitempty"`
	Error       *string    `json:"error,omitempty"`
	Progress    int        `gorm:"default:0" json:"progress"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Connector Connector `gorm:"foreignKey:ConnectorID" json:"connector,omitempty"`
}

type JobOptions struct {
	PackageName   string                 `json:"package_name"`
	ServiceName   string                 `json:"service_name"`
	OutputFormat  string                 `json:"output_format"`
	IncludeTests  bool                   `json:"include_tests"`
	IncludeDocs   bool                   `json:"include_docs"`
	Validation    string                 `json:"validation"`
	CustomOptions map[string]interface{} `json:"custom_options"`
}

type JobResult struct {
	Files        []GeneratedFile `json:"files"`
	Success      bool            `json:"success"`
	ErrorCount   int             `json:"error_count"`
	WarningCount int             `json:"warning_count"`
	Duration     int64           `json:"duration"` // milliseconds
	FileCount    int             `json:"file_count"`
	LineCount    int             `json:"line_count"`
}

type GeneratedFile struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Type     string `json:"type"` // source, test, doc, config
	Language string `json:"language"`
	Size     int64  `json:"size"`
}

// APIKey tracks user API keys
type APIKey struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Name      string     `gorm:"not null" json:"name"`
	KeyHash   string     `gorm:"not null;uniqueIndex" json:"-"`
	KeyPrefix string     `gorm:"not null" json:"key_prefix"` // First 8 characters for display
	Scopes    []string   `gorm:"type:text" json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	LastUsed  *time.Time `json:"last_used,omitempty"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// Table names
func (ConnectorAnalytics) TableName() string { return "connector_analytics" }
func (AgentAnalytics) TableName() string     { return "agent_analytics" }
func (AgentLog) TableName() string           { return "agent_logs" }
func (GenerationJob) TableName() string      { return "generation_jobs" }
func (APIKey) TableName() string             { return "api_keys" }

// BeforeCreate hooks
func (ca *ConnectorAnalytics) BeforeCreate(tx *gorm.DB) error {
	if ca.ID == uuid.Nil {
		ca.ID = uuid.New()
	}
	return nil
}

func (aa *AgentAnalytics) BeforeCreate(tx *gorm.DB) error {
	if aa.ID == uuid.Nil {
		aa.ID = uuid.New()
	}
	return nil
}

func (al *AgentLog) BeforeCreate(tx *gorm.DB) error {
	if al.ID == uuid.Nil {
		al.ID = uuid.New()
	}
	return nil
}

func (gj *GenerationJob) BeforeCreate(tx *gorm.DB) error {
	if gj.ID == uuid.Nil {
		gj.ID = uuid.New()
	}
	return nil
}

func (ak *APIKey) BeforeCreate(tx *gorm.DB) error {
	if ak.ID == uuid.Nil {
		ak.ID = uuid.New()
	}
	return nil
}
