package repository

import (
	"context"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/models"
)

// DatabaseManagerImpl implements the DatabaseManager interface
type DatabaseManagerImpl struct {
	db    *gorm.DB
	redis *redis.Client
}

// NewDatabaseManager creates a new database manager instance
func NewDatabaseManager(db *gorm.DB, redis *redis.Client) DatabaseManager {
	return &DatabaseManagerImpl{
		db:    db,
		redis: redis,
	}
}

// GetDB returns the GORM database instance
func (dm *DatabaseManagerImpl) GetDB() *gorm.DB {
	return dm.db
}

// WithTenant returns a database instance scoped to a tenant
func (dm *DatabaseManagerImpl) WithTenant(tenantID string) *gorm.DB {
	return dm.db.Where("tenant_id = ?", tenantID)
}

// WithUser returns a database instance scoped to a user
func (dm *DatabaseManagerImpl) WithUser(userID string) *gorm.DB {
	return dm.db.Where("user_id = ?", userID)
}

// BeginTx begins a new transaction
func (dm *DatabaseManagerImpl) BeginTx(ctx context.Context) (*gorm.DB, error) {
	tx := dm.db.Begin()
	return tx, tx.Error
}

// WithTx returns a new database manager instance with the given transaction
func (dm *DatabaseManagerImpl) WithTx(tx *gorm.DB) DatabaseManager {
	return &DatabaseManagerImpl{
		db:    tx,
		redis: dm.redis,
	}
}

// HealthCheck performs a database health check
func (dm *DatabaseManagerImpl) HealthCheck(ctx context.Context) error {
	sqlDB, err := dm.db.DB()
	if err != nil {
		return err
	}

	return sqlDB.PingContext(ctx)
}

// GetConnectionStats returns database connection statistics
func (dm *DatabaseManagerImpl) GetConnectionStats() ConnectionStats {
	sqlDB, err := dm.db.DB()
	if err != nil {
		return ConnectionStats{}
	}

	stats := sqlDB.Stats()

	// Get database sizes
	var dbSize, indexSize int64
	dm.db.Raw("SELECT pg_database_size(current_database())").Scan(&dbSize)
	dm.db.Raw("SELECT pg_indexes_size(current_database())").Scan(&indexSize)

	return ConnectionStats{
		OpenConnections:    stats.OpenConnections,
		IdleConnections:    stats.Idle,
		MaxConnections:     stats.MaxOpenConnections,
		WaitingConnections: int(stats.WaitCount),
		DatabaseSize:       dbSize,
		IndexSize:          indexSize,
		// Would need additional tracking for query metrics
		AverageQueryTime: 0,
		QueriesPerSecond: 0,
	}
}

// RunMigrations runs database migrations
func (dm *DatabaseManagerImpl) RunMigrations() error {
	// Auto-migrate all models
	return dm.db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.UserSession{},
		&models.Document{},
		&models.DocumentChunk{},
		&models.DocumentProcessingJob{},
		&models.EmbeddingJob{},
		&models.Policy{},
		&models.PolicyEvaluation{},
		&models.APIKey{},
		&models.TokenUsage{},
		&models.DocumentAccessLog{},
		&models.AuditLog{},
	)
}

// RollbackMigration rolls back to a specific migration version
func (dm *DatabaseManagerImpl) RollbackMigration(version string) error {
	// This would integrate with a proper migration tool like golang-migrate
	// For now, return an error as it's not implemented
	return gorm.ErrNotImplemented
}

// GetMigrationHistory returns the migration history
func (dm *DatabaseManagerImpl) GetMigrationHistory() []Migration {
	// This would query a migrations table
	// For now, return empty slice
	return []Migration{}
}

// Repository factory methods

// Tenants returns the tenant repository
func (dm *DatabaseManagerImpl) Tenants() TenantRepository {
	return NewTenantRepository(dm.db)
}

// Users returns the user repository
func (dm *DatabaseManagerImpl) Users() UserRepository {
	return NewUserRepository(dm.db)
}

// Documents returns the document repository
func (dm *DatabaseManagerImpl) Documents() DocumentRepository {
	return NewDocumentRepository(dm.db)
}

// DocumentChunks returns the document chunk repository
func (dm *DatabaseManagerImpl) DocumentChunks() DocumentChunkRepository {
	return NewDocumentChunkRepository(dm.db)
}

// Policies returns the policy repository
func (dm *DatabaseManagerImpl) Policies() PolicyRepository {
	return NewPolicyRepository(dm.db)
}

// APIKeys returns the API key repository
func (dm *DatabaseManagerImpl) APIKeys() APIKeyRepository {
	return NewAPIKeyRepository(dm.db)
}

// AuditLogs returns the audit log repository
func (dm *DatabaseManagerImpl) AuditLogs() AuditLogRepository {
	return NewAuditLogRepository(dm.db)
}
