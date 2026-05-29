package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/models"
)

// Database errors
var (
	ErrRecordNotFound     = gorm.ErrRecordNotFound
	ErrDuplicatedKey      = gorm.ErrDuplicatedKey
	ErrInvalidTransaction = gorm.ErrInvalidTransaction
)

// Pagination parameters for list queries
type Pagination struct {
	Page     int    `json:"page" validate:"min=1"`
	PageSize int    `json:"page_size" validate:"min=1,max=100"`
	SortBy   string `json:"sort_by"`
	SortDesc bool   `json:"sort_desc"`
}

// Default pagination values
func DefaultPagination() Pagination {
	return Pagination{
		Page:     1,
		PageSize: 20,
		SortBy:   "created_at",
		SortDesc: true,
	}
}

// Offset calculates the database offset
func (p Pagination) Offset() int {
	return (p.Page - 1) * p.PageSize
}

// Limit returns the page size
func (p Pagination) Limit() int {
	return p.PageSize
}

// PaginatedResult represents a paginated query result
type PaginatedResult[T any] struct {
	Items      []T   `json:"items"`
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
	HasNext    bool  `json:"has_next"`
	HasPrev    bool  `json:"has_prev"`
}

// NewPaginatedResult creates a new paginated result
func NewPaginatedResult[T any](items []T, total int64, pagination Pagination) PaginatedResult[T] {
	totalPages := int((total + int64(pagination.PageSize) - 1) / int64(pagination.PageSize))

	return PaginatedResult[T]{
		Items:      items,
		Total:      total,
		Page:       pagination.Page,
		PageSize:   pagination.PageSize,
		TotalPages: totalPages,
		HasNext:    pagination.Page < totalPages,
		HasPrev:    pagination.Page > 1,
	}
}

// QueryOptions represents additional query options
type QueryOptions struct {
	TenantID string         `json:"tenant_id"`
	UserID   string         `json:"user_id,omitempty"`
	Filters  map[string]any `json:"filters,omitempty"`
	Preloads []string       `json:"preloads,omitempty"`
	Select   string         `json:"select,omitempty"`
	Omit     string         `json:"omit,omitempty"`
	Having   map[string]any `json:"having,omitempty"`
	Group    string         `json:"group,omitempty"`
	Distinct bool           `json:"distinct,omitempty"`
	Unscoped bool           `json:"unscoped,omitempty"`
	RawQuery string         `json:"raw_query,omitempty"`
	RawArgs  []any          `json:"raw_args,omitempty"`
}

// BaseRepository interface defines common repository operations
type BaseRepository[T any] interface {
	// CRUD operations
	Create(ctx context.Context, entity *T) error
	CreateBatch(ctx context.Context, entities []*T) error
	GetByID(ctx context.Context, id string) (*T, error)
	GetByUUID(ctx context.Context, id string) (*T, error)
	Update(ctx context.Context, entity *T) error
	UpdateFields(ctx context.Context, id string, fields map[string]any) error
	Delete(ctx context.Context, id string) error
	DeleteBatch(ctx context.Context, ids []string) error
	SoftDelete(ctx context.Context, id string) error
	Restore(ctx context.Context, id string) error

	// Query operations
	List(ctx context.Context, pagination Pagination) (PaginatedResult[T], error)
	ListWithOptions(ctx context.Context, pagination Pagination, opts QueryOptions) (PaginatedResult[T], error)
	Count(ctx context.Context, opts QueryOptions) (int64, error)
	Exists(ctx context.Context, id string) (bool, error)
	FindOne(ctx context.Context, opts QueryOptions) (*T, error)
	FindMany(ctx context.Context, opts QueryOptions) ([]T, error)

	// Transaction operations
	WithTx(tx *gorm.DB) BaseRepository[T]
}

// TenantRepository interface for tenant-specific operations
type TenantRepository interface {
	BaseRepository[models.Tenant]

	// Tenant-specific operations
	GetByDomain(ctx context.Context, domain string) (*models.Tenant, error)
	GetActiveTenants(ctx context.Context) ([]models.Tenant, error)
	GetTenantsBySubscription(ctx context.Context, tier string) ([]models.Tenant, error)
	UpdateStatus(ctx context.Context, id string, status string) error
	GetTenantStatistics(ctx context.Context, tenantID string) (*TenantStats, error)
	CheckResourceLimits(ctx context.Context, tenantID string, resourceType string) (bool, error)

	// Configuration operations
	UpdateConfig(ctx context.Context, id string, config map[string]any) error
	UpdateSettings(ctx context.Context, id string, settings map[string]any) error
	GetTenantConfig(ctx context.Context, tenantID string) (map[string]any, error)
}

// UserRepository interface for user-specific operations
type UserRepository interface {
	BaseRepository[models.User]

	// User authentication operations
	GetByEmail(ctx context.Context, tenantID, email string) (*models.User, error)
	GetByEmailOnly(ctx context.Context, email string) (*models.User, error)
	GetBySessionToken(ctx context.Context, token string) (*models.User, error)

	// User management operations
	GetUsersByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.User], error)
	GetUsersByRole(ctx context.Context, tenantID, role string) ([]models.User, error)
	GetActiveUsers(ctx context.Context, tenantID string) ([]models.User, error)
	UpdatePassword(ctx context.Context, userID string, hashedPassword string) error
	UpdateLastLogin(ctx context.Context, userID string) error

	// Security operations
	LockUser(ctx context.Context, userID string, duration time.Duration) error
	UnlockUser(ctx context.Context, userID string) error
	IncrementFailedLogin(ctx context.Context, userID string) error
	ResetFailedLogin(ctx context.Context, userID string) error
	VerifyEmail(ctx context.Context, userID string) error
	EnableMFA(ctx context.Context, userID string, secret []byte) error
	DisableMFA(ctx context.Context, userID string) error

	// User statistics
	GetUserStatistics(ctx context.Context, tenantID string) (*UserStats, error)
	GetUserActivity(ctx context.Context, userID string, timeRange time.Duration) ([]models.AuditLog, error)
}

// DocumentRepository interface for document-specific operations
type DocumentRepository interface {
	BaseRepository[models.Document]

	// Document query operations
	GetByChecksum(ctx context.Context, checksum string) (*models.Document, error)
	GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.Document], error)
	GetByStatus(ctx context.Context, tenantID, status string) ([]models.Document, error)
	GetByCreator(ctx context.Context, tenantID, creatorID string, pagination Pagination) (PaginatedResult[models.Document], error)
	GetByClassification(ctx context.Context, tenantID, classification string) ([]models.Document, error)
	GetDocumentsNeedingProcessing(ctx context.Context, tenantID string) ([]models.Document, error)
	GetExpiredDocuments(ctx context.Context, tenantID string) ([]models.Document, error)

	// Document management operations
	UpdateProcessingStatus(ctx context.Context, id, status string) error
	UpdateExtractionStatus(ctx context.Context, id, status string) error
	UpdateDLPStatus(ctx context.Context, id, status string) error
	UpdateMetadata(ctx context.Context, id string, metadata map[string]any) error
	AddTag(ctx context.Context, id string, tag string) error
	RemoveTag(ctx context.Context, id string, tag string) error

	// Document search
	SearchDocuments(ctx context.Context, tenantID string, query string, filters map[string]any, pagination Pagination) (PaginatedResult[models.Document], error)
	SearchByContentType(ctx context.Context, tenantID, contentType string) ([]models.Document, error)

	// Document statistics
	GetDocumentStatistics(ctx context.Context, tenantID string) (*DocumentStats, error)
	GetStorageUsage(ctx context.Context, tenantID string) (*StorageStats, error)
}

// DocumentChunkRepository interface for chunk-specific operations
type DocumentChunkRepository interface {
	BaseRepository[models.DocumentChunk]

	// Chunk query operations
	GetByDocument(ctx context.Context, documentID string, pagination Pagination) (PaginatedResult[models.DocumentChunk], error)
	GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.DocumentChunk], error)
	GetChunksNeedingEmbedding(ctx context.Context, tenantID string) ([]models.DocumentChunk, error)
	GetChunksByStatus(ctx context.Context, tenantID, status string) ([]models.DocumentChunk, error)

	// Chunk management operations
	UpdateEmbeddingStatus(ctx context.Context, id, status string) error
	UpdateEmbedding(ctx context.Context, id string, embedding []float32, processingTime int) error
	UpdateTokenCount(ctx context.Context, id string, tokenCount int) error

	// Vector search operations
	VectorSearch(ctx context.Context, tenantID string, queryVector []float32, limit int, threshold float32) ([]models.DocumentChunk, error)
	HybridSearch(ctx context.Context, tenantID string, queryText string, queryVector []float32, limit int, vectorWeight, textWeight float32) ([]models.DocumentChunk, error)

	// Chunk statistics
	GetChunkStatistics(ctx context.Context, tenantID string) (*ChunkStats, error)
	GetEmbeddingProgress(ctx context.Context, tenantID string) (*EmbeddingProgress, error)
}

// PolicyRepository interface for policy-specific operations
type PolicyRepository interface {
	BaseRepository[models.Policy]

	// Policy query operations
	GetActivePolicies(ctx context.Context, tenantID string) ([]models.Policy, error)
	GetPoliciesByType(ctx context.Context, tenantID, policyType string) ([]models.Policy, error)
	GetPolicyByName(ctx context.Context, tenantID, name string) (*models.Policy, error)
	GetPoliciesByPriority(ctx context.Context, tenantID string) ([]models.Policy, error)

	// Policy management operations
	ActivatePolicy(ctx context.Context, id string) error
	DeactivatePolicy(ctx context.Context, id string) error
	UpdatePolicyContent(ctx context.Context, id string, regoPolicy string) error
	UpdatePolicyVersion(ctx context.Context, id string, version int) error

	// Policy evaluation
	GetEvaluationsByPolicy(ctx context.Context, policyID string, timeRange time.Duration) ([]models.PolicyEvaluation, error)
	GetEvaluationsByUser(ctx context.Context, userID string, timeRange time.Duration) ([]models.PolicyEvaluation, error)

	// Policy statistics
	GetPolicyStatistics(ctx context.Context, tenantID string) (*PolicyStats, error)
	GetEvaluationMetrics(ctx context.Context, tenantID string, timeRange time.Duration) (*EvaluationMetrics, error)
}

// APIKeyRepository interface for API key-specific operations
type APIKeyRepository interface {
	BaseRepository[models.APIKey]

	// API key query operations
	GetByKeyHash(ctx context.Context, keyHash string) (*models.APIKey, error)
	GetByPrefix(ctx context.Context, prefix string) (*models.APIKey, error)
	GetActiveKeys(ctx context.Context, tenantID string) ([]models.APIKey, error)
	GetExpiredKeys(ctx context.Context, tenantID string) ([]models.APIKey, error)
	GetKeysExceedingUsage(ctx context.Context, tenantID string) ([]models.APIKey, error)

	// API key management operations
	UpdateLastUsed(ctx context.Context, id string) error
	IncrementUsage(ctx context.Context, id string) error
	RevokeKey(ctx context.Context, id string) error
	RotateKey(ctx context.Context, id string, newKeyHash string, newPrefix string) error
	ExtendExpiration(ctx context.Context, id string, newExpiration time.Time) error

	// API key statistics
	GetKeyUsageStatistics(ctx context.Context, keyID string, timeRange time.Duration) (*KeyUsageStats, error)
	GetTenantAPIUsage(ctx context.Context, tenantID string, timeRange time.Duration) (*TenantAPIStats, error)
}

// AuditLogRepository interface for audit-specific operations
type AuditLogRepository interface {
	BaseRepository[models.AuditLog]

	// Audit query operations
	GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.AuditLog], error)
	GetByUser(ctx context.Context, userID string, timeRange time.Duration, pagination Pagination) (PaginatedResult[models.AuditLog], error)
	GetByAction(ctx context.Context, tenantID, action string, timeRange time.Duration) ([]models.AuditLog, error)
	GetByResource(ctx context.Context, tenantID, resourceType, resourceID string) ([]models.AuditLog, error)
	GetByTimeRange(ctx context.Context, tenantID string, start, end time.Time, pagination Pagination) (PaginatedResult[models.AuditLog], error)

	// Compliance operations
	GetComplianceReports(ctx context.Context, tenantID string, timeRange time.Duration) (*ComplianceReport, error)
	GetSecurityEvents(ctx context.Context, tenantID string, timeRange time.Duration) ([]models.AuditLog, error)
	GetAccessLogs(ctx context.Context, tenantID string, timeRange time.Duration) ([]models.AuditLog, error)

	// Audit statistics
	GetAuditStatistics(ctx context.Context, tenantID string, timeRange time.Duration) (*AuditStats, error)
	GetActivitySummary(ctx context.Context, tenantID string, timeRange time.Duration) (*ActivitySummary, error)
}

// Database manager interface
type DatabaseManager interface {
	// Connection management
	GetDB() *gorm.DB
	WithTenant(tenantID string) *gorm.DB
	WithUser(userID string) *gorm.DB

	// Transaction management
	BeginTx(ctx context.Context) (*gorm.DB, error)
	WithTx(tx *gorm.DB) DatabaseManager

	// Health checks
	HealthCheck(ctx context.Context) error
	GetConnectionStats() ConnectionStats

	// Migration management
	RunMigrations() error
	RollbackMigration(version string) error
	GetMigrationHistory() []Migration

	// Repository factory
	Tenants() TenantRepository
	Users() UserRepository
	Documents() DocumentRepository
	DocumentChunks() DocumentChunkRepository
	Policies() PolicyRepository
	APIKeys() APIKeyRepository
	AuditLogs() AuditLogRepository
}

// Statistics and metrics types

type TenantStats struct {
	TotalUsers         int64     `json:"total_users"`
	ActiveUsers        int64     `json:"active_users"`
	TotalDocuments     int64     `json:"total_documents"`
	ProcessedDocuments int64     `json:"processed_documents"`
	TotalStorage       int64     `json:"total_storage_bytes"`
	TotalTokens        int64     `json:"total_tokens"`
	TotalCost          float64   `json:"total_cost_usd"`
	ActiveAPIKeys      int64     `json:"active_api_keys"`
	ActivePolicies     int64     `json:"active_policies"`
	LastActivity       time.Time `json:"last_activity"`
}

type UserStats struct {
	TotalUsers    int64 `json:"total_users"`
	ActiveUsers   int64 `json:"active_users"`
	LockedUsers   int64 `json:"locked_users"`
	EmailVerified int64 `json:"email_verified"`
	MFAEnabled    int64 `json:"mfa_enabled"`
	FailedLogins  int64 `json:"failed_logins_today"`
	NewUsers      int64 `json:"new_users_today"`
}

type DocumentStats struct {
	TotalDocuments     int64 `json:"total_documents"`
	ProcessedDocuments int64 `json:"processed_documents"`
	PendingDocuments   int64 `json:"pending_documents"`
	FailedDocuments    int64 `json:"failed_documents"`
	TotalSize          int64 `json:"total_size_bytes"`
	AverageSize        int64 `json:"average_size_bytes"`
	TotalChunks        int64 `json:"total_chunks"`
	EmbeddedChunks     int64 `json:"embedded_chunks"`
	PendingEmbeddings  int64 `json:"pending_embeddings"`
}

type StorageStats struct {
	TotalUsed     int64   `json:"total_used_bytes"`
	DocumentsSize int64   `json:"documents_size_bytes"`
	ChunksSize    int64   `json:"chunks_size_bytes"`
	Available     int64   `json:"available_bytes"`
	UsagePercent  float64 `json:"usage_percent"`
}

type ChunkStats struct {
	TotalChunks       int64 `json:"total_chunks"`
	EmbeddedChunks    int64 `json:"embedded_chunks"`
	PendingEmbeddings int64 `json:"pending_embeddings"`
	FailedEmbeddings  int64 `json:"failed_embeddings"`
	TotalTokens       int64 `json:"total_tokens"`
	AverageChunkSize  int64 `json:"average_chunk_size"`
	AverageTokenCount int64 `json:"average_token_count"`
}

type EmbeddingProgress struct {
	Total      int64   `json:"total"`
	Completed  int64   `json:"completed"`
	Pending    int64   `json:"pending"`
	Failed     int64   `json:"failed"`
	InProgress int64   `json:"in_progress"`
	Percent    float64 `json:"percent_complete"`
}

type PolicyStats struct {
	TotalPolicies    int64            `json:"total_policies"`
	ActivePolicies   int64            `json:"active_policies"`
	PoliciesByType   map[string]int64 `json:"policies_by_type"`
	TotalEvaluations int64            `json:"total_evaluations"`
	AverageEvalTime  float64          `json:"average_evaluation_time_ms"`
	EvaluationRate   float64          `json:"evaluations_per_second"`
}

type EvaluationMetrics struct {
	TotalEvaluations    int64            `json:"total_evaluations"`
	AllowResults        int64            `json:"allow_results"`
	DenyResults         int64            `json:"deny_results"`
	AverageTime         float64          `json:"average_time_ms"`
	SuccessRate         float64          `json:"success_rate"`
	EvaluationsByPolicy map[string]int64 `json:"evaluations_by_policy"`
}

type KeyUsageStats struct {
	TotalRequests       int64            `json:"total_requests"`
	TotalTokens         int64            `json:"total_tokens"`
	TotalCost           float64          `json:"total_cost_usd"`
	AverageTokens       float64          `json:"average_tokens_per_request"`
	SuccessRate         float64          `json:"success_rate"`
	RequestsByModel     map[string]int64 `json:"requests_by_model"`
	RequestsByOperation map[string]int64 `json:"requests_by_operation"`
}

type TenantAPIStats struct {
	TotalAPIKeys  int64             `json:"total_api_keys"`
	ActiveAPIKeys int64             `json:"active_api_keys"`
	TotalRequests int64             `json:"total_requests"`
	TotalTokens   int64             `json:"total_tokens"`
	TotalCost     float64           `json:"total_cost_usd"`
	TopAPIKeys    []KeyUsageSummary `json:"top_api_keys"`
}

type KeyUsageSummary struct {
	KeyID    string  `json:"key_id"`
	KeyName  string  `json:"key_name"`
	Requests int64   `json:"requests"`
	Tokens   int64   `json:"tokens"`
	Cost     float64 `json:"cost_usd"`
}

type ComplianceReport struct {
	TotalEvents      int64             `json:"total_events"`
	EventsByType     map[string]int64  `json:"events_by_type"`
	EventsByUser     map[string]int64  `json:"events_by_user"`
	SecurityEvents   []models.AuditLog `json:"security_events"`
	DataAccessEvents []models.AuditLog `json:"data_access_events"`
	PolicyViolations []models.AuditLog `json:"policy_violations"`
	ComplianceScore  float64           `json:"compliance_score"`
}

type AuditStats struct {
	TotalEvents      int64            `json:"total_events"`
	EventsByAction   map[string]int64 `json:"events_by_action"`
	EventsByUser     map[string]int64 `json:"events_by_user"`
	EventsByResource map[string]int64 `json:"events_by_resource"`
	FailedOperations int64            `json:"failed_operations"`
	SecurityEvents   int64            `json:"security_events"`
}

type ActivitySummary struct {
	TotalUsers       int64            `json:"total_users"`
	ActiveUsers      int64            `json:"active_users"`
	NewUsers         int64            `json:"new_users"`
	TotalOperations  int64            `json:"total_operations"`
	OperationsByType map[string]int64 `json:"operations_by_type"`
	PeakActivity     time.Time        `json:"peak_activity"`
	AverageActivity  float64          `json:"average_operations_per_hour"`
}

type ConnectionStats struct {
	OpenConnections    int     `json:"open_connections"`
	IdleConnections    int     `json:"idle_connections"`
	MaxConnections     int     `json:"max_connections"`
	WaitingConnections int     `json:"waiting_connections"`
	AverageQueryTime   float64 `json:"average_query_time_ms"`
	QueriesPerSecond   float64 `json:"queries_per_second"`
	DatabaseSize       int64   `json:"database_size_bytes"`
	IndexSize          int64   `json:"index_size_bytes"`
}

type Migration struct {
	Version   string    `json:"version"`
	Name      string    `json:"name"`
	Applied   bool      `json:"applied"`
	CreatedAt time.Time `json:"created_at"`
	AppliedAt time.Time `json:"applied_at"`
}
