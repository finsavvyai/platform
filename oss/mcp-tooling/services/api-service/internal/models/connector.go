package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Connector struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string     `gorm:"not null" json:"name"`
	Description string     `json:"description"`
	Type        string     `gorm:"not null" json:"type"` // openapi, graphql, etc.
	Config      ConfigData `gorm:"type:jsonb" json:"config"`
	Status      string     `gorm:"default:pending" json:"status"` // pending, active, error, disabled
	Version     string     `json:"version"`
	Endpoint    string     `json:"endpoint"`

	// Deployment info
	DeployedAt     *time.Time      `json:"deployed_at"`
	LastDeployed   *time.Time      `json:"last_deployed"`
	GeneratedCode  string          `gorm:"type:text" json:"generated_code,omitempty"`
	DeploymentInfo *DeploymentInfo `gorm:"type:jsonb" json:"deployment_info,omitempty"`
	Runtime        string          `json:"runtime"`
	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	User           User                 `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Agents         []Agent              `gorm:"foreignKey:ConnectorID" json:"agents,omitempty"`
	Deployments    []Deployment         `gorm:"foreignKey:ConnectorID" json:"deployments,omitempty"`
	Analytics      []ConnectorAnalytics `gorm:"foreignKey:ConnectorID" json:"analytics,omitempty"`
	GenerationJobs []GenerationJob      `gorm:"foreignKey:ConnectorID" json:"generation_jobs,omitempty"`
}

type DeploymentInfo struct {
	Platform    string            `json:"platform"`
	Region      string            `json:"region"`
	URL         string            `json:"url"`
	WorkerID    string            `json:"worker_id,omitempty"`
	Environment map[string]string `json:"environment,omitempty"`
}

const (
	ConnectorStatusActive   = "active"
	ConnectorStatusPending  = "pending"
	ConnectorStatusError    = "error"
	ConnectorStatusDisabled = "disabled"

	ConnectorRuntimeWorkerTS = "worker-ts"
	ConnectorRuntimeGo       = "go"
	ConnectorRuntimeNode     = "node"
)

type ConfigData struct {
	OpenAPISpec    interface{}            `json:"openapi_spec,omitempty"`
	Auth           AuthConfig             `json:"auth,omitempty"`
	Headers        map[string]string      `json:"headers,omitempty"`
	BaseURL        string                 `json:"base_url,omitempty"`
	CustomSettings map[string]interface{} `json:"custom_settings,omitempty"`
}

type AuthConfig struct {
	Type     string                 `json:"type"` // none, api_key, oauth2, bearer
	Settings map[string]interface{} `json:"settings"`
}

func (c *Connector) TableName() string {
	return "connectors"
}

func (c *Connector) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
