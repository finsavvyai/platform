// Package models defines the database-row-shape structs the
// infrastructure repositories operate on. Distinct from the
// internal/domain/models package, which holds the domain-layer
// representations.
package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Tenant represents a multi-tenant organization
type Tenant struct {
	ID                     uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Name                   string         `gorm:"size:255;not null" json:"name" validate:"required,max=255"`
	Domain                 string         `gorm:"size:255;uniqueIndex;not null" json:"domain" validate:"required,max=255"`
	Status                 string         `gorm:"type:tenant_status;not null;default:'trial';index" json:"status" validate:"oneof=active suspended trial deleted"`
	Config                 datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"config"`
	Settings               datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"settings"`
	SubscriptionTier       string         `gorm:"size:50;not null;default:'basic';index" json:"subscription_tier" validate:"max=50"`
	DataRegion             string         `gorm:"size:50;not null;default:'us-east-1'" json:"data_region" validate:"max=50"`
	ContactEmail           string         `gorm:"size:255" json:"contact_email" validate:"omitempty,email,max=255"`
	BillingInfo            datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"billing_info"`
	CreatedAt              time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt              time.Time      `gorm:"default:now()" json:"updated_at"`
	Metadata               datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	RetentionPolicy        datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"retention_policy"`
	ResourceLimits         datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"resource_limits"`
	ComplianceRequirements datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"compliance_requirements"`

	// Relationships
	Users     []User     `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"users,omitempty"`
	APIKeys   []APIKey   `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"api_keys,omitempty"`
	Documents []Document `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"documents,omitempty"`
	Policies  []Policy   `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"policies,omitempty"`
	AuditLogs []AuditLog `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"audit_logs,omitempty"`
}

// TableName specifies the table name for Tenant
func (Tenant) TableName() string {
	return "tenants"
}

// BeforeCreate GORM hook
func (t *Tenant) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

// User represents user authentication and authorization
type User struct {
	ID                  uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	Email               string         `gorm:"size:255;not null;index" json:"email" validate:"required,email,max=255"`
	EncryptedPassword   []byte         `gorm:"type:bytea;not null" json:"-"`
	PasswordHash        string         `gorm:"size:255;not null" json:"-"`
	Role                string         `gorm:"type:user_role;not null;default:'user';index" json:"role" validate:"oneof=super_admin tenant_admin data_scientist analyst viewer user"`
	Permissions         datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"permissions"`
	Metadata            datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	CreatedAt           time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt           time.Time      `gorm:"default:now()" json:"updated_at"`
	LastLogin           *time.Time     `gorm:"index" json:"last_login,omitempty"`
	IsActive            bool           `gorm:"default:true;index" json:"is_active"`
	MFAEnabled          bool           `gorm:"default:false" json:"mfa_enabled"`
	MFASecret           []byte         `gorm:"type:bytea" json:"-"`
	EmailVerified       bool           `gorm:"default:false" json:"email_verified"`
	PhoneNumber         string         `gorm:"size:20" json:"phone_number" validate:"omitempty,max=20"`
	PhoneVerified       bool           `gorm:"default:false" json:"phone_verified"`
	FailedLoginAttempts int            `gorm:"default:0" json:"failed_login_attempts"`
	LockedUntil         *time.Time     `json:"locked_until,omitempty"`
	Profile             datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"profile"`
	Preferences         datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"preferences"`

	// Relationships
	Tenant             Tenant              `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Documents          []Document          `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL" json:"documents,omitempty"`
	UserSessions       []UserSession       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user_sessions,omitempty"`
	PolicyEvaluations  []PolicyEvaluation  `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"policy_evaluations,omitempty"`
	TokenUsage         []TokenUsage        `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"token_usage,omitempty"`
	DocumentAccessLogs []DocumentAccessLog `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"document_access_logs,omitempty"`
	Policies           []Policy            `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL" json:"policies,omitempty"`
}

// TableName specifies the table name for User
func (User) TableName() string {
	return "users"
}

// BeforeCreate GORM hook
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// UserSession represents user login sessions
type UserSession struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"user_id" validate:"required"`
	Token     string         `gorm:"size:255;uniqueIndex;not null" json:"token" validate:"required,max=255"`
	ExpiresAt time.Time      `gorm:"not null;index" json:"expires_at" validate:"required"`
	CreatedAt time.Time      `gorm:"default:now()" json:"created_at"`
	LastUsed  time.Time      `gorm:"default:now()" json:"last_used"`
	IPAddress string         `gorm:"size:45" json:"ip_address" validate:"omitempty,max=45"`
	UserAgent string         `gorm:"type:text" json:"user_agent"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	Metadata  datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	User User `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

// TableName specifies the table name for UserSession
func (UserSession) TableName() string {
	return "user_sessions"
}

// BeforeCreate GORM hook
func (us *UserSession) BeforeCreate(tx *gorm.DB) error {
	if us.ID == uuid.Nil {
		us.ID = uuid.New()
	}
	return nil
}

// Document represents document metadata and storage tracking
type Document struct {
	ID                   uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID             uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	Filename             string         `gorm:"size:1000;not null" json:"filename" validate:"required,max=1000"`
	OriginalFilename     string         `gorm:"size:1000;not null" json:"original_filename" validate:"required,max=1000"`
	ContentType          string         `gorm:"size:255;not null;index" json:"content_type" validate:"required,max=255"`
	FileSize             int64          `gorm:"not null" json:"file_size" validate:"required,min=1"`
	Checksum             string         `gorm:"size:64;not null;index" json:"checksum" validate:"required,len=64"`
	StoragePath          string         `gorm:"size:1000;not null" json:"storage_path" validate:"required,max=1000"`
	StorageBucket        string         `gorm:"size:255;not null" json:"storage_bucket" validate:"required,max=255"`
	StorageProvider      string         `gorm:"size:50;not null;default:'r2'" json:"storage_provider" validate:"max=50"`
	Metadata             datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	ExtractionStatus     string         `gorm:"type:document_status;not null;default:'pending';index" json:"extraction_status" validate:"oneof=pending processing completed failed"`
	ProcessingStatus     string         `gorm:"type:document_status;not null;default:'pending';index" json:"processing_status" validate:"oneof=pending processing completed failed"`
	DLPStatus            string         `gorm:"type:document_status;not null;default:'pending';index" json:"dlp_status" validate:"oneof=pending processing completed failed"`
	CreatedAt            time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"default:now()" json:"updated_at"`
	CreatedBy            uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:SET NULL" json:"created_by" validate:"required"`
	EncryptionKeyID      string         `gorm:"size:255" json:"encryption_key_id" validate:"omitempty,max=255"`
	EncryptionAlgorithm  string         `gorm:"type:encryption_algorithm;default:'aes-256-gcm'" json:"encryption_algorithm" validate:"oneof=aes-256-gcm aes-256-cbc chacha20-poly1305"`
	RetentionPolicy      datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"retention_policy"`
	AccessLevel          string         `gorm:"size:50;not null;default:'private';index" json:"access_level" validate:"max=50"`
	Tags                 Tags           `gorm:"type:jsonb;not null;default:'[]'" json:"tags"`
	Classification       string         `gorm:"type:data_classification;not null;default:'internal';index" json:"classification" validate:"oneof=public internal confidential restricted"`
	ContentHash          string         `gorm:"size:64;index" json:"content_hash" validate:"omitempty,len=64"`
	Language             string         `gorm:"size:10;default:'en'" json:"language" validate:"max=10"`
	ProcessingDurationMs int            `json:"processing_duration_ms"`

	// Relationships
	Tenant         Tenant                  `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Creator        User                    `gorm:"foreignKey:CreatedBy;references:ID" json:"creator,omitempty"`
	Chunks         []DocumentChunk         `gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE" json:"chunks,omitempty"`
	ProcessingJobs []DocumentProcessingJob `gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE" json:"processing_jobs,omitempty"`
	AccessLogs     []DocumentAccessLog     `gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE" json:"access_logs,omitempty"`
}

// TableName specifies the table name for Document
func (Document) TableName() string {
	return "documents"
}

// BeforeCreate GORM hook
func (d *Document) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// Tags is a custom type for handling JSON arrays of tags
type Tags []string

// Value implements the driver.Valuer interface
func (t Tags) Value() (driver.Value, error) {
	if t == nil {
		return nil, nil
	}
	return json.Marshal(t)
}

// Scan implements the sql.Scanner interface
func (t *Tags) Scan(value interface{}) error {
	if value == nil {
		*t = nil
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, t)
	case string:
		return json.Unmarshal([]byte(v), t)
	default:
		return fmt.Errorf("cannot scan %T into Tags", value)
	}
}

// DocumentChunk represents text chunks for RAG processing
type DocumentChunk struct {
	ID                  uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	DocumentID          uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"document_id" validate:"required"`
	TenantID            uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	ChunkIndex          int            `gorm:"not null" json:"chunk_index" validate:"min=0"`
	Content             string         `gorm:"type:text;not null" json:"content" validate:"required"`
	ContentLength       int            `gorm:"not null" json:"content_length" validate:"min=1"`
	ChunkType           string         `gorm:"size:50;not null;default:'text'" json:"chunk_type" validate:"max=50"`
	EmbeddingModel      string         `gorm:"size:100" json:"embedding_model" validate:"omitempty,max=100"`
	EmbeddingDimensions int            `json:"embedding_dimensions" validate:"omitempty,min=1"`
	Embedding           datatypes.JSON `gorm:"type:vector(1536)" json:"embedding,omitempty"`
	EmbeddingStatus     string         `gorm:"type:document_status;not null;default:'pending';index" json:"embedding_status" validate:"oneof=pending processing completed failed"`
	Metadata            datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	CreatedAt           time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt           time.Time      `gorm:"default:now()" json:"updated_at"`
	ProcessingTimeMs    int            `json:"processing_time_ms"`
	Checksum            string         `gorm:"size:64;not null" json:"checksum" validate:"required,len=64"`
	TokenCount          int            `gorm:"index" json:"token_count" validate:"omitempty,min=0"`
	SourcePageNumber    int            `json:"source_page_number" validate:"omitempty,min=1"`
	SourceSection       string         `gorm:"size:255" json:"source_section" validate:"omitempty,max=255"`
	Language            string         `gorm:"size:10;default:'en'" json:"language" validate:"max=10"`

	// Relationships
	Document      Document       `gorm:"foreignKey:DocumentID;references:ID" json:"document,omitempty"`
	Tenant        Tenant         `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	EmbeddingJobs []EmbeddingJob `gorm:"foreignKey:ChunkID;constraint:OnDelete:CASCADE" json:"embedding_jobs,omitempty"`
}

// TableName specifies the table name for DocumentChunk
func (DocumentChunk) TableName() string {
	return "document_chunks"
}

// BeforeCreate GORM hook
func (dc *DocumentChunk) BeforeCreate(tx *gorm.DB) error {
	if dc.ID == uuid.Nil {
		dc.ID = uuid.New()
	}
	return nil
}

// DocumentProcessingJob represents document processing jobs
type DocumentProcessingJob struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	DocumentID  uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"document_id" validate:"required"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	JobType     string         `gorm:"size:100;not null" json:"job_type" validate:"required,max=100"`
	Status      string         `gorm:"type:document_status;not null;index" json:"status" validate:"oneof=pending processing completed failed"`
	Progress    int            `gorm:"default:0" json:"progress" validate:"min=0,max=100"`
	CreatedAt   time.Time      `gorm:"default:now();index" json:"created_at"`
	StartedAt   *time.Time     `gorm:"index" json:"started_at,omitempty"`
	CompletedAt *time.Time     `gorm:"index" json:"completed_at,omitempty"`
	Error       string         `gorm:"type:text" json:"error,omitempty"`
	RetryCount  int            `gorm:"default:0" json:"retry_count" validate:"min=0"`
	MaxRetries  int            `gorm:"default:3" json:"max_retries" validate:"min=0"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Document Document `gorm:"foreignKey:DocumentID;references:ID" json:"document,omitempty"`
	Tenant   Tenant   `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
}

// TableName specifies the table name for DocumentProcessingJob
func (DocumentProcessingJob) TableName() string {
	return "document_processing_jobs"
}

// BeforeCreate GORM hook
func (dpj *DocumentProcessingJob) BeforeCreate(tx *gorm.DB) error {
	if dpj.ID == uuid.Nil {
		dpj.ID = uuid.New()
	}
	return nil
}

// EmbeddingJob represents embedding processing jobs
type EmbeddingJob struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	ChunkID     uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"chunk_id" validate:"required"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	Model       string         `gorm:"size:100;not null" json:"model" validate:"required,max=100"`
	Status      string         `gorm:"type:document_status;not null;index" json:"status" validate:"oneof=pending processing completed failed"`
	CreatedAt   time.Time      `gorm:"default:now();index" json:"created_at"`
	StartedAt   *time.Time     `gorm:"index" json:"started_at,omitempty"`
	CompletedAt *time.Time     `gorm:"index" json:"completed_at,omitempty"`
	Error       string         `gorm:"type:text" json:"error,omitempty"`
	RetryCount  int            `gorm:"default:0" json:"retry_count" validate:"min=0"`
	MaxRetries  int            `gorm:"default:3" json:"max_retries" validate:"min=0"`
	DurationMs  int            `json:"duration_ms" validate:"omitempty,min=0"`
	TokensUsed  int            `json:"tokens_used" validate:"omitempty,min=0"`
	CostUsd     float64        `gorm:"type:decimal(10,4)" json:"cost_usd" validate:"omitempty,min=0"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Chunk  DocumentChunk `gorm:"foreignKey:ChunkID;references:ID" json:"chunk,omitempty"`
	Tenant Tenant        `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
}

// TableName specifies the table name for EmbeddingJob
func (EmbeddingJob) TableName() string {
	return "embedding_jobs"
}

// BeforeCreate GORM hook
func (ej *EmbeddingJob) BeforeCreate(tx *gorm.DB) error {
	if ej.ID == uuid.Nil {
		ej.ID = uuid.New()
	}
	return nil
}

// Policy represents OPA policy management
type Policy struct {
	ID           uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID     uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	Name         string         `gorm:"size:255;not null" json:"name" validate:"required,max=255"`
	Description  string         `gorm:"type:text" json:"description"`
	Type         string         `gorm:"type:policy_type;not null;index" json:"type" validate:"oneof=auth data_access dlp cost compliance"`
	RegoPolicy   string         `gorm:"type:text;not null" json:"rego_policy" validate:"required"`
	Version      int            `gorm:"not null;default:1;index" json:"version" validate:"min=1"`
	IsActive     bool           `gorm:"default:true;index" json:"is_active"`
	Priority     int            `gorm:"default:100;index" json:"priority" validate:"min=0"`
	CreatedAt    time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"default:now()" json:"updated_at"`
	CreatedBy    uuid.UUID      `gorm:"type:uuid;not null;constraint:OnDelete:SET NULL" json:"created_by" validate:"required"`
	Metadata     datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	TestCases    datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"test_cases"`
	Dependencies datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"dependencies"`
	Tags         Tags           `gorm:"type:jsonb;not null;default:'[]'" json:"tags"`

	// Relationships
	Tenant            Tenant             `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Creator           User               `gorm:"foreignKey:CreatedBy;references:ID" json:"creator,omitempty"`
	PolicyEvaluations []PolicyEvaluation `gorm:"foreignKey:PolicyID;constraint:OnDelete:CASCADE" json:"policy_evaluations,omitempty"`
}

// TableName specifies the table name for Policy
func (Policy) TableName() string {
	return "policies"
}

// BeforeCreate GORM hook
func (p *Policy) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// PolicyEvaluation represents policy evaluation results
type PolicyEvaluation struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	PolicyID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"policy_id" validate:"required"`
	UserID      uuid.UUID      `gorm:"type:uuid;index;constraint:OnDelete:SET NULL" json:"user_id" validate:"omitempty"`
	Input       datatypes.JSON `gorm:"type:jsonb;not null" json:"input"`
	Result      bool           `gorm:"not null;index" json:"result" validate:"required"`
	Explanation string         `gorm:"type:text" json:"explanation"`
	DurationMs  int            `json:"duration_ms" validate:"omitempty,min=0"`
	CreatedAt   time.Time      `gorm:"default:now();index" json:"created_at"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Tenant Tenant `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Policy Policy `gorm:"foreignKey:PolicyID;references:ID" json:"policy,omitempty"`
	User   User   `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

// TableName specifies the table name for PolicyEvaluation
func (PolicyEvaluation) TableName() string {
	return "policy_evaluations"
}

// BeforeCreate GORM hook
func (pe *PolicyEvaluation) BeforeCreate(tx *gorm.DB) error {
	if pe.ID == uuid.Nil {
		pe.ID = uuid.New()
	}
	return nil
}

// APIKey represents API key management
type APIKey struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	Name        string         `gorm:"size:255;not null" json:"name" validate:"required,max=255"`
	KeyHash     string         `gorm:"size:255;uniqueIndex;not null" json:"-" validate:"required"`
	KeyPrefix   string         `gorm:"size:20;not null" json:"key_prefix" validate:"required,max=20"`
	IsActive    bool           `gorm:"default:true;index" json:"is_active"`
	ExpiresAt   *time.Time     `gorm:"index" json:"expires_at,omitempty"`
	LastUsed    *time.Time     `gorm:"index" json:"last_used,omitempty"`
	UsageCount  int            `gorm:"default:0" json:"usage_count" validate:"min=0"`
	MaxUsage    int            `json:"max_usage" validate:"omitempty,min=1"`
	Permissions datatypes.JSON `gorm:"type:jsonb;not null;default:'[]'" json:"permissions"`
	RateLimit   int            `gorm:"default:1000" json:"rate_limit" validate:"min=0"`
	CreatedAt   time.Time      `gorm:"default:now();index" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"default:now()" json:"updated_at"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid;not null;constraint:OnDelete:SET NULL" json:"created_by" validate:"required"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Tenant     Tenant       `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Creator    User         `gorm:"foreignKey:CreatedBy;references:ID" json:"creator,omitempty"`
	TokenUsage []TokenUsage `gorm:"foreignKey:APIKeyID;constraint:OnDelete:CASCADE" json:"token_usage,omitempty"`
}

// TableName specifies the table name for APIKey
func (APIKey) TableName() string {
	return "api_keys"
}

// BeforeCreate GORM hook
func (ak *APIKey) BeforeCreate(tx *gorm.DB) error {
	if ak.ID == uuid.Nil {
		ak.ID = uuid.New()
	}
	return nil
}

// TokenUsage represents API token usage tracking
type TokenUsage struct {
	ID         uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID   uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	APIKeyID   uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"api_key_id" validate:"required"`
	UserID     uuid.UUID      `gorm:"type:uuid;index;constraint:OnDelete:SET NULL" json:"user_id" validate:"omitempty"`
	TokensUsed int            `gorm:"not null" json:"tokens_used" validate:"required,min=1"`
	CostUsd    float64        `gorm:"type:decimal(10,4);not null" json:"cost_usd" validate:"required,min=0"`
	Model      string         `gorm:"size:100;not null;index" json:"model" validate:"required,max=100"`
	Operation  string         `gorm:"size:100;not null;index" json:"operation" validate:"required,max=100"`
	DurationMs int            `gorm:"not null" json:"duration_ms" validate:"required,min=0"`
	CreatedAt  time.Time      `gorm:"default:now();index" json:"created_at"`
	RequestID  uuid.UUID      `gorm:"type:uuid;index" json:"request_id" validate:"omitempty"`
	IPAddress  string         `gorm:"size:45" json:"ip_address" validate:"omitempty,max=45"`
	UserAgent  string         `gorm:"type:text" json:"user_agent"`
	Metadata   datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Tenant Tenant `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	APIKey APIKey `gorm:"foreignKey:APIKeyID;references:ID" json:"api_key,omitempty"`
	User   User   `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

// TableName specifies the table name for TokenUsage
func (TokenUsage) TableName() string {
	return "token_usage"
}

// BeforeCreate GORM hook
func (tu *TokenUsage) BeforeCreate(tx *gorm.DB) error {
	if tu.ID == uuid.Nil {
		tu.ID = uuid.New()
	}
	return nil
}

// DocumentAccessLog represents document access logging
type DocumentAccessLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	DocumentID  uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"document_id" validate:"required"`
	UserID      uuid.UUID      `gorm:"type:uuid;index;constraint:OnDelete:SET NULL" json:"user_id" validate:"omitempty"`
	Action      string         `gorm:"type:audit_action;not null;index" json:"action" validate:"oneof=create read update delete login logout access_denied"`
	AccessLevel string         `gorm:"size:50;not null" json:"access_level" validate:"required,max=50"`
	IPAddress   string         `gorm:"size:45" json:"ip_address" validate:"omitempty,max=45"`
	UserAgent   string         `gorm:"type:text" json:"user_agent"`
	Success     bool           `gorm:"not null;default:true;index" json:"success"`
	Reason      string         `gorm:"type:text" json:"reason,omitempty"`
	CreatedAt   time.Time      `gorm:"default:now();index" json:"created_at"`
	RequestID   uuid.UUID      `gorm:"type:uuid;index" json:"request_id" validate:"omitempty"`
	SessionID   uuid.UUID      `gorm:"type:uuid;index" json:"session_id" validate:"omitempty"`
	Metadata    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`

	// Relationships
	Tenant   Tenant   `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	Document Document `gorm:"foreignKey:DocumentID;references:ID" json:"document,omitempty"`
	User     User     `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

// TableName specifies the table name for DocumentAccessLog
func (DocumentAccessLog) TableName() string {
	return "document_access_log"
}

// BeforeCreate GORM hook
func (dal *DocumentAccessLog) BeforeCreate(tx *gorm.DB) error {
	if dal.ID == uuid.Nil {
		dal.ID = uuid.New()
	}
	return nil
}

// AuditLog represents comprehensive audit trail
type AuditLog struct {
	ID               uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	TenantID         uuid.UUID      `gorm:"type:uuid;not null;index;constraint:OnDelete:CASCADE" json:"tenant_id" validate:"required"`
	UserID           uuid.UUID      `gorm:"type:uuid;index;constraint:OnDelete:SET NULL" json:"user_id" validate:"omitempty"`
	Action           string         `gorm:"type:audit_action;not null;index" json:"action" validate:"oneof=create read update delete login logout access_denied"`
	ResourceType     string         `gorm:"size:100;not null;index" json:"resource_type" validate:"required,max=100"`
	ResourceID       uuid.UUID      `gorm:"type:uuid;index" json:"resource_id" validate:"omitempty"`
	Details          datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"details"`
	IPAddress        string         `gorm:"size:45" json:"ip_address" validate:"omitempty,max=45"`
	UserAgent        string         `gorm:"type:text" json:"user_agent"`
	SessionID        uuid.UUID      `gorm:"type:uuid;index" json:"session_id" validate:"omitempty"`
	CreatedAt        time.Time      `gorm:"default:now();index" json:"created_at"`
	RequestID        uuid.UUID      `gorm:"type:uuid;index" json:"request_id" validate:"omitempty"`
	ResponseStatus   int            `gorm:"index" json:"response_status" validate:"omitempty,min=100,max=599"`
	ProcessingTimeMs int            `json:"processing_time_ms" validate:"omitempty,min=0"`
	Metadata         datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"metadata"`
	ComplianceTags   Tags           `gorm:"type:jsonb;not null;default:'[]'" json:"compliance_tags"`

	// Relationships
	Tenant Tenant `gorm:"foreignKey:TenantID;references:ID" json:"tenant,omitempty"`
	User   User   `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
}

// TableName specifies the table name for AuditLog
func (AuditLog) TableName() string {
	return "audit_logs"
}

// BeforeCreate GORM hook
func (al *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if al.ID == uuid.Nil {
		al.ID = uuid.New()
	}
	return nil
}
