package shared

import (
	"time"
)

// Common shared models used across all bounded contexts

// BaseRequest represents the base structure for all API requests
type BaseRequest struct {
	RequestID string                 `json:"request_id"`
	UserID    string                 `json:"user_id,omitempty"`
	TenantID  string                 `json:"tenant_id,omitempty"`
	SessionID string                 `json:"session_id,omitempty"`
	IPAddress string                 `json:"ip_address,omitempty"`
	UserAgent string                 `json:"user_agent,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// BaseResponse represents the base structure for all API responses
type BaseResponse struct {
	RequestID string                 `json:"request_id"`
	Success   bool                   `json:"success"`
	Message   string                 `json:"message,omitempty"`
	Data      interface{}            `json:"data,omitempty"`
	Error     *ErrorDetail           `json:"error,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// ErrorDetail represents detailed error information
type ErrorDetail struct {
	Code       string                 `json:"code"`
	Message    string                 `json:"message"`
	Details    map[string]interface{} `json:"details,omitempty"`
	Retryable  bool                   `json:"retryable"`
	RetryAfter *int                   `json:"retry_after,omitempty"`
}

// Pagination represents pagination parameters
type Pagination struct {
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	TotalItems int  `json:"total_items"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// Sort represents sorting parameters
type Sort struct {
	Field string `json:"field"`
	Order string `json:"order"` // ASC, DESC
}

// Filter represents filtering parameters
type Filter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, gte, lt, lte, in, like, contains
	Value    interface{} `json:"value"`
}

// QueryOptions represents common query options
type QueryOptions struct {
	Pagination *Pagination `json:"pagination,omitempty"`
	Sort       *Sort       `json:"sort,omitempty"`
	Filters    []Filter    `json:"filters,omitempty"`
	Search     string      `json:"search,omitempty"`
	Fields     []string    `json:"fields,omitempty"`
}

// TenantContext represents tenant-specific context
type TenantContext struct {
	TenantID  string                 `json:"tenant_id"`
	Name      string                 `json:"name"`
	Plan      string                 `json:"plan"`
	Status    string                 `json:"status"`
	CreatedAt time.Time              `json:"created_at"`
	Config    TenantConfig           `json:"config"`
	Features  []string               `json:"features"`
	Settings  map[string]interface{} `json:"settings"`
}

type TenantConfig struct {
	AllowedDomains []string               `json:"allowed_domains"`
	MaxUsers       int                    `json:"max_users"`
	MaxDocuments   int                    `json:"max_documents"`
	MaxStorage     int64                  `json:"max_storage"` // in bytes
	Features       []string               `json:"features"`
	Settings       map[string]interface{} `json:"settings"`
	Security       SecurityConfig         `json:"security"`
	AI             AIConfig               `json:"ai"`
}

type SecurityConfig struct {
	RequireMFA      bool           `json:"require_mfa"`
	AllowedIPRanges []string       `json:"allowed_ip_ranges"`
	SessionTimeout  int            `json:"session_timeout"` // in minutes
	PasswordPolicy  PasswordPolicy `json:"password_policy"`
	DataRetention   int            `json:"data_retention"`  // in days
	AuditRetention  int            `json:"audit_retention"` // in days
}

type PasswordPolicy struct {
	MinLength        int  `json:"min_length"`
	RequireUppercase bool `json:"require_uppercase"`
	RequireLowercase bool `json:"require_lowercase"`
	RequireNumbers   bool `json:"require_numbers"`
	RequireSymbols   bool `json:"require_symbols"`
	ExpiryDays       int  `json:"expiry_days"`
	HistoryCount     int  `json:"history_count"`
}

type AIConfig struct {
	Model        string                 `json:"model"`
	MaxTokens    int                    `json:"max_tokens"`
	Temperature  float64                `json:"temperature"`
	RAGEnabled   bool                   `json:"rag_enabled"`
	VectorSearch VectorSearchConfig     `json:"vector_search"`
	Prompts      map[string]string      `json:"prompts"`
	Settings     map[string]interface{} `json:"settings"`
}

type VectorSearchConfig struct {
	Dimensions          int     `json:"dimensions"`
	SimilarityThreshold float64 `json:"similarity_threshold"`
	MaxResults          int     `json:"max_results"`
	IncludeMetadata     bool    `json:"include_metadata"`
}

// UserContext represents user-specific context
type UserContext struct {
	UserID      string                 `json:"user_id"`
	TenantID    string                 `json:"tenant_id"`
	Email       string                 `json:"email"`
	Role        string                 `json:"role"`
	Permissions []string               `json:"permissions"`
	Active      bool                   `json:"active"`
	Profile     UserProfile            `json:"profile"`
	Sessions    []Session              `json:"sessions"`
	Preferences map[string]interface{} `json:"preferences"`
	LastLoginAt *time.Time             `json:"last_login_at"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type UserProfile struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	AvatarURL  string `json:"avatar_url"`
	Timezone   string `json:"timezone"`
	Language   string `json:"language"`
	Phone      string `json:"phone,omitempty"`
	Department string `json:"department,omitempty"`
	Title      string `json:"title,omitempty"`
	ManagerID  string `json:"manager_id,omitempty"`
}

type Session struct {
	SessionID  string    `json:"session_id"`
	IPAddress  string    `json:"ip_address"`
	UserAgent  string    `json:"user_agent"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	Active     bool      `json:"active"`
}

// DocumentContext represents document-related context
type DocumentContext struct {
	DocumentID    string                 `json:"document_id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description,omitempty"`
	Type          string                 `json:"type"`
	MimeType      string                 `json:"mime_type"`
	Size          int64                  `json:"size"`
	Checksum      string                 `json:"checksum"`
	Status        string                 `json:"status"`
	Tags          []string               `json:"tags"`
	Metadata      map[string]interface{} `json:"metadata"`
	Version       int                    `json:"version"`
	Chunks        []DocumentChunk        `json:"chunks,omitempty"`
	VectorCount   int                    `json:"vector_count"`
	ProcessedAt   *time.Time             `json:"processed_at,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	AccessControl AccessControl          `json:"access_control"`
}

type DocumentChunk struct {
	ChunkID    string                 `json:"chunk_id"`
	DocumentID string                 `json:"document_id"`
	Index      int                    `json:"index"`
	Content    string                 `json:"content"`
	Metadata   map[string]interface{} `json:"metadata"`
	Vector     []float32              `json:"vector,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

type AccessControl struct {
	Owner       string       `json:"owner"`
	Permissions []Permission `json:"permissions"`
	Public      bool         `json:"public"`
	ShareLink   string       `json:"share_link,omitempty"`
	ExpiresAt   *time.Time   `json:"expires_at,omitempty"`
}

type Permission struct {
	SubjectID   string     `json:"subject_id"`   // user or group ID
	SubjectType string     `json:"subject_type"` // user, group, role
	Actions     []string   `json:"actions"`      // read, write, delete, share
	GrantedAt   time.Time  `json:"granted_at"`
	GrantedBy   string     `json:"granted_by"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

// RAGContext represents RAG-specific context
type RAGContext struct {
	QueryID      string                 `json:"query_id"`
	TenantID     string                 `json:"tenant_id"`
	UserID       string                 `json:"user_id"`
	Query        string                 `json:"query"`
	VectorQuery  []float32              `json:"vector_query,omitempty"`
	Context      []string               `json:"context,omitempty"`
	Response     string                 `json:"response"`
	Citations    []Citation             `json:"citations"`
	Metadata     map[string]interface{} `json:"metadata"`
	TokenUsage   TokenUsage             `json:"token_usage"`
	Confidence   float64                `json:"confidence"`
	ResponseTime int64                  `json:"response_time_ms"`
	Model        string                 `json:"model"`
	Status       string                 `json:"status"`
	CreatedAt    time.Time              `json:"created_at"`
	ProcessedAt  *time.Time             `json:"processed_at,omitempty"`
}

type Citation struct {
	DocumentID   string  `json:"document_id"`
	DocumentName string  `json:"document_name"`
	ChunkID      string  `json:"chunk_id"`
	Text         string  `json:"text"`
	Score        float64 `json:"score"`
	Position     int     `json:"position"`
}

type TokenUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

// PolicyContext represents policy-related context
type PolicyContext struct {
	PolicyID  string                 `json:"policy_id"`
	TenantID  string                 `json:"tenant_id"`
	Name      string                 `json:"name"`
	Type      string                 `json:"type"`
	Status    string                 `json:"status"`
	Rules     []PolicyRule           `json:"rules"`
	Variables map[string]interface{} `json:"variables"`
	Metadata  map[string]interface{} `json:"metadata"`
	Version   int                    `json:"version"`
	CreatedBy string                 `json:"created_by"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type PolicyRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Condition   string                 `json:"condition"`
	Action      string                 `json:"action"`
	Priority    int                    `json:"priority"`
	Enabled     bool                   `json:"enabled"`
	Parameters  map[string]interface{} `json:"parameters"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// PaymentContext represents payment-related context (PCI DSS)
type PaymentContext struct {
	PaymentID    string                 `json:"payment_id"`
	TenantID     string                 `json:"tenant_id"`
	UserID       string                 `json:"user_id"`
	Amount       int64                  `json:"amount"` // in cents
	Currency     string                 `json:"currency"`
	Status       string                 `json:"status"`
	Description  string                 `json:"description,omitempty"`
	TokenID      string                 `json:"token_id"` // Tokenized payment method
	ProcessorID  string                 `json:"processor_id"`
	GatewayTxnID string                 `json:"gateway_txn_id,omitempty"`
	Metadata     map[string]interface{} `json:"metadata"`
	CreatedAt    time.Time              `json:"created_at"`
	ProcessedAt  *time.Time             `json:"processed_at,omitempty"`
	ExpiresAt    *time.Time             `json:"expires_at,omitempty"`
}

type PaymentMethod struct {
	TokenID     string     `json:"token_id"`
	UserID      string     `json:"user_id"`
	TenantID    string     `json:"tenant_id"`
	Type        string     `json:"type"` // credit_card, bank_account, etc.
	CardType    string     `json:"card_type,omitempty"`
	LastFour    string     `json:"last_four"`
	ExpiryMonth string     `json:"expiry_month,omitempty"`
	ExpiryYear  string     `json:"expiry_year,omitempty"`
	CardBrand   string     `json:"card_brand,omitempty"`
	BankName    string     `json:"bank_name,omitempty"`
	Nickname    string     `json:"nickname,omitempty"`
	Default     bool       `json:"default"`
	Status      string     `json:"status"` // active, inactive, expired
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
}

// AuditContext represents audit-related context
type AuditContext struct {
	AuditID      string                 `json:"audit_id"`
	TenantID     string                 `json:"tenant_id"`
	UserID       string                 `json:"user_id,omitempty"`
	ResourceID   string                 `json:"resource_id,omitempty"`
	ResourceType string                 `json:"resource_type,omitempty"`
	Action       string                 `json:"action"`
	Resource     string                 `json:"resource"`
	Outcome      string                 `json:"outcome"` // SUCCESS, FAILURE, PARTIAL
	Description  string                 `json:"description,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	SessionID    string                 `json:"session_id,omitempty"`
	Timestamp    time.Time              `json:"timestamp"`
	Severity     string                 `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	Category     string                 `json:"category"`
	Tags         []string               `json:"tags,omitempty"`
}

// SecurityContext represents security-related context
type SecurityContext struct {
	IncidentID   string                 `json:"incident_id"`
	TenantID     string                 `json:"tenant_id"`
	UserID       string                 `json:"user_id,omitempty"`
	Type         string                 `json:"type"`
	Severity     string                 `json:"severity"`
	Status       string                 `json:"status"`
	Title        string                 `json:"title"`
	Description  string                 `json:"description"`
	IPAddress    string                 `json:"ip_address,omitempty"`
	UserAgent    string                 `json:"user_agent,omitempty"`
	ResourceID   string                 `json:"resource_id,omitempty"`
	ResourceType string                 `json:"resource_type,omitempty"`
	Details      map[string]interface{} `json:"details"`
	Actions      []string               `json:"actions_taken,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	ResolvedAt   *time.Time             `json:"resolved_at,omitempty"`
	ResolvedBy   string                 `json:"resolved_by,omitempty"`
}

// HealthStatus represents system health status
type HealthStatus struct {
	Status      string                 `json:"status"` // HEALTHY, DEGRADED, UNHEALTHY
	Timestamp   time.Time              `json:"timestamp"`
	Version     string                 `json:"version"`
	Environment string                 `json:"environment"`
	Services    []ServiceHealth        `json:"services"`
	Metrics     map[string]interface{} `json:"metrics"`
	Checks      map[string]bool        `json:"checks"`
}

type ServiceHealth struct {
	Name      string                 `json:"name"`
	Status    string                 `json:"status"`
	Message   string                 `json:"message,omitempty"`
	LastCheck time.Time              `json:"last_check"`
	Metrics   map[string]interface{} `json:"metrics,omitempty"`
}

// Metrics represents system metrics
type Metrics struct {
	Timestamp  time.Time              `json:"timestamp"`
	Counters   map[string]int64       `json:"counters"`
	Gauges     map[string]float64     `json:"gauges"`
	Timers     map[string]interface{} `json:"timers"`
	Histograms map[string]interface{} `json:"histograms"`
	Labels     map[string]string      `json:"labels"`
}

// Constants for common values
const (
	// Status values
	StatusActive     = "ACTIVE"
	StatusInactive   = "INACTIVE"
	StatusSuspended  = "SUSPENDED"
	StatusDeleted    = "DELETED"
	StatusPending    = "PENDING"
	StatusCompleted  = "COMPLETED"
	StatusFailed     = "FAILED"
	StatusProcessing = "PROCESSING"

	// User roles
	RoleAdmin  = "ADMIN"
	RoleUser   = "USER"
	RoleViewer = "VIEWER"
	RoleEditor = "EDITOR"
	RoleOwner  = "OWNER"

	// Document statuses
	DocumentStatusUploaded   = "UPLOADED"
	DocumentStatusProcessing = "PROCESSING"
	DocumentStatusProcessed  = "PROCESSED"
	DocumentStatusFailed     = "FAILED"
	DocumentStatusDeleted    = "DELETED"

	// Payment statuses
	PaymentStatusPending   = "PENDING"
	PaymentStatusCompleted = "COMPLETED"
	PaymentStatusFailed    = "FAILED"
	PaymentStatusRefunded  = "REFUNDED"
	PaymentStatusVoided    = "VOIDED"

	// Security severities
	SeverityLow      = "LOW"
	SeverityMedium   = "MEDIUM"
	SeverityHigh     = "HIGH"
	SeverityCritical = "CRITICAL"

	// Health statuses
	HealthHealthy   = "HEALTHY"
	HealthDegraded  = "DEGRADED"
	HealthUnhealthy = "UNHEALTHY"
)
