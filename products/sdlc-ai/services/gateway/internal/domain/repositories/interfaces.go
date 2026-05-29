package repositories

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// BaseRepository defines common repository operations
type BaseRepository[T any] interface {
	Create(ctx context.Context, entity *T) error
	GetByID(ctx context.Context, id uuid.UUID) (*T, error)
	Update(ctx context.Context, id uuid.UUID, updates interface{}) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, filter interface{}, limit, offset int) ([]*T, error)
	Count(ctx context.Context, filter interface{}) (int, error)
}

// TenantRepository defines operations for tenant management
type TenantRepository interface {
	BaseRepository[models.Tenant]

	// Tenant-specific operations
	GetByDomain(ctx context.Context, domain string) (*models.Tenant, error)
	GetActive(ctx context.Context) ([]*models.Tenant, error)
	GetBySubscriptionTier(ctx context.Context, tier string) ([]*models.Tenant, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.TenantStatus) error
	CheckDomainExists(ctx context.Context, domain string) (bool, error)
	GetTenantCount(ctx context.Context) (int, error)
}

// UserRepository defines operations for user management
type UserRepository interface {
	BaseRepository[models.User]

	// User-specific operations
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*models.User, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.UserFilter) ([]*models.User, error)
	GetActiveUsers(ctx context.Context, tenantID uuid.UUID) ([]*models.User, error)
	GetByRole(ctx context.Context, tenantID uuid.UUID, role models.UserRole) ([]*models.User, error)
	UpdateLastLogin(ctx context.Context, id uuid.UUID) error
	IncrementFailedLogin(ctx context.Context, id uuid.UUID) error
	ResetFailedLogin(ctx context.Context, id uuid.UUID) error
	LockAccount(ctx context.Context, id uuid.UUID, duration int) error
	UnlockAccount(ctx context.Context, id uuid.UUID) error
	GetUserCount(ctx context.Context, tenantID uuid.UUID) (int, error)
	SearchUsers(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.User, error)
}

// UserSessionRepository defines operations for session management
type UserSessionRepository interface {
	BaseRepository[models.UserSession]

	// Session-specific operations
	GetByToken(ctx context.Context, sessionToken string) (*models.UserSession, error)
	GetByRefreshToken(ctx context.Context, refreshToken string) (*models.UserSession, error)
	GetActiveSessions(ctx context.Context, userID uuid.UUID) ([]*models.UserSession, error)
	RevokeSession(ctx context.Context, sessionToken string) error
	RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error
	CleanupExpiredSessions(ctx context.Context) (int, error)
	UpdateLastActivity(ctx context.Context, sessionToken string) error
}

// DocumentRepository defines operations for document management
type DocumentRepository interface {
	BaseRepository[models.Document]

	// Document-specific operations
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.DocumentFilter) ([]*models.Document, error)
	GetByCreatedBy(ctx context.Context, tenantID, createdBy uuid.UUID, limit, offset int) ([]*models.Document, error)
	GetByStatus(ctx context.Context, tenantID uuid.UUID, status models.DocumentStatus) ([]*models.Document, error)
	GetByClassification(ctx context.Context, tenantID uuid.UUID, classification models.DataClassification) ([]*models.Document, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status models.DocumentStatus, statusType string) error
	GetDocumentCount(ctx context.Context, tenantID uuid.UUID) (int, error)
	GetTotalStorageSize(ctx context.Context, tenantID uuid.UUID) (int64, error)
	SearchDocuments(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.Document, error)
	GetDocumentsByTags(ctx context.Context, tenantID uuid.UUID, tags []string) ([]*models.Document, error)
}

// DocumentChunkRepository defines operations for document chunk management
type DocumentChunkRepository interface {
	BaseRepository[models.DocumentChunk]

	// Chunk-specific operations
	GetByDocument(ctx context.Context, documentID uuid.UUID, limit, offset int) ([]*models.DocumentChunk, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.DocumentChunkFilter) ([]*models.DocumentChunk, error)
	GetByStatus(ctx context.Context, tenantID uuid.UUID, status models.DocumentStatus) ([]*models.DocumentChunk, error)
	UpdateEmbedding(ctx context.Context, id uuid.UUID, embedding []float32, status models.DocumentStatus) error
	GetChunksForEmbedding(ctx context.Context, tenantID uuid.UUID, limit int) ([]*models.DocumentChunk, error)
	GetChunkCount(ctx context.Context, documentID uuid.UUID) (int, error)
	DeleteByDocument(ctx context.Context, documentID uuid.UUID) error
	SearchChunks(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.DocumentChunk, error)
}

// APIKeyRepository defines operations for API key management
type APIKeyRepository interface {
	BaseRepository[models.APIKey]

	// API key-specific operations
	GetByHash(ctx context.Context, keyHash string) (*models.APIKey, error)
	GetByPrefix(ctx context.Context, keyPrefix string) (*models.APIKey, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.APIKeyFilter) ([]*models.APIKey, error)
	GetByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.APIKey, error)
	UpdateUsage(ctx context.Context, id uuid.UUID, ipAddress string) error
	RevokeAPIKey(ctx context.Context, id uuid.UUID) error
	GetActiveAPIKeys(ctx context.Context, tenantID uuid.UUID) ([]*models.APIKey, error)
	CleanupExpiredKeys(ctx context.Context) (int, error)
	GetAPIKeyCount(ctx context.Context, tenantID uuid.UUID) (int, error)
	SearchAPIKeys(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.APIKey, error)
}

// PolicyRepository defines operations for policy management
type PolicyRepository interface {
	BaseRepository[models.Policy]

	// Policy-specific operations
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.PolicyFilter) ([]*models.Policy, error)
	GetByType(ctx context.Context, tenantID uuid.UUID, policyType models.PolicyType) ([]*models.Policy, error)
	GetActive(ctx context.Context, tenantID uuid.UUID) ([]*models.Policy, error)
	UpdateVersion(ctx context.Context, id uuid.UUID, newVersion int) error
	DeactivatePolicy(ctx context.Context, id uuid.UUID) error
	ActivatePolicy(ctx context.Context, id uuid.UUID) error
	GetPolicyCount(ctx context.Context, tenantID uuid.UUID) (int, error)
	SearchPolicies(ctx context.Context, tenantID uuid.UUID, query string, limit, offset int) ([]*models.Policy, error)
}

// PolicyEvaluationRepository defines operations for policy evaluation logging
type PolicyEvaluationRepository interface {
	Create(ctx context.Context, evaluation *models.PolicyEvaluation) error
	GetByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*models.PolicyEvaluation, error)
	GetByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.PolicyEvaluation, error)
	GetByPolicy(ctx context.Context, policyID uuid.UUID, limit, offset int) ([]*models.PolicyEvaluation, error)
	GetByRequest(ctx context.Context, requestID uuid.UUID) (*models.PolicyEvaluation, error)
	GetEvaluationStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error)
	CleanupOldEvaluations(ctx context.Context, olderThanDays int) (int, error)
}

// AuditLogRepository defines operations for audit logging
type AuditLogRepository interface {
	Create(ctx context.Context, log *models.AuditLog) error
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]*models.AuditLog, error)
	GetByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*models.AuditLog, error)
	GetByAction(ctx context.Context, tenantID uuid.UUID, action string, limit, offset int) ([]*models.AuditLog, error)
	GetByResource(ctx context.Context, tenantID uuid.UUID, resourceType string, resourceID uuid.UUID) ([]*models.AuditLog, error)
	GetAuditStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error)
	CleanupOldLogs(ctx context.Context, olderThanDays int) (int, error)
	ExportAuditLogs(ctx context.Context, tenantID uuid.UUID, filter models.AuditLogFilter) ([]byte, error)
}

// TokenUsageRepository defines operations for token usage tracking
type TokenUsageRepository interface {
	Create(ctx context.Context, usage *models.TokenUsage) error
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.TokenUsageFilter) ([]*models.TokenUsage, error)
	GetByUser(ctx context.Context, userID uuid.UUID, filter models.TokenUsageFilter) ([]*models.TokenUsage, error)
	GetByAPIKey(ctx context.Context, apiKeyID uuid.UUID, filter models.TokenUsageFilter) ([]*models.TokenUsage, error)
	GetUsageStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error)
	GetMonthlyUsage(ctx context.Context, tenantID uuid.UUID, year, month int) (int, float64, error)
	GetDailyUsage(ctx context.Context, tenantID uuid.UUID, startDate, endDate string) ([]map[string]interface{}, error)
	CleanupOldUsage(ctx context.Context, olderThanDays int) (int, error)
}

// DLPScanRepository defines operations for DLP scan tracking
type DLPScanRepository interface {
	Create(ctx context.Context, scan *models.DLPScan) error
	GetByTenant(ctx context.Context, tenantID uuid.UUID, filter models.DLPScanFilter) ([]*models.DLPScan, error)
	GetByContent(ctx context.Context, contentID uuid.UUID) ([]*models.DLPScan, error)
	GetHighRiskScans(ctx context.Context, tenantID uuid.UUID, threshold float64) ([]*models.DLPScan, error)
	GetScanStats(ctx context.Context, tenantID uuid.UUID, timeRange string) (map[string]interface{}, error)
	CleanupOldScans(ctx context.Context, olderThanDays int) (int, error)
}

// HealthRepository defines operations for health monitoring
type HealthRepository interface {
	CheckDatabaseHealth(ctx context.Context) error
	GetDatabaseStats(ctx context.Context) (map[string]interface{}, error)
	GetConnectionPoolStats(ctx context.Context) (map[string]interface{}, error)
	CheckTableHealth(ctx context.Context, tableName string) error
}

// TransactionManager defines transaction management operations
type TransactionManager interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Commit(ctx context.Context, tx pgx.Tx) error
	Rollback(ctx context.Context, tx pgx.Tx) error
	WithTransaction(ctx context.Context, fn func(pgx.Tx) error) error
}

// RepositoryRegistry holds all repository instances
type RepositoryRegistry struct {
	Tenant           TenantRepository
	User             UserRepository
	UserSession      UserSessionRepository
	Document         DocumentRepository
	DocumentChunk    DocumentChunkRepository
	APIKey           APIKeyRepository
	Policy           PolicyRepository
	PolicyEvaluation PolicyEvaluationRepository
	AuditLog         AuditLogRepository
	TokenUsage       TokenUsageRepository
	DLPScan          DLPScanRepository
	Health           HealthRepository
	Transaction      TransactionManager
}

// NewRepositoryRegistry creates a new repository registry
// Repository implementations should be injected by the caller
func NewRepositoryRegistry(_ *pgxpool.Pool) *RepositoryRegistry {
	return &RepositoryRegistry{}
}
