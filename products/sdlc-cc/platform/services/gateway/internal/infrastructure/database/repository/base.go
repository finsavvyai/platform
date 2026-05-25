package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/models"
	"gorm.io/gorm"
)

// BaseRepositoryImpl provides a generic implementation of BaseRepository
type BaseRepositoryImpl[T any] struct {
	db    *gorm.DB
	model T
}

// NewBaseRepository creates a new base repository
func NewBaseRepository[T any](db *gorm.DB) BaseRepository[T] {
	var model T
	return &BaseRepositoryImpl[T]{
		db:    db,
		model: model,
	}
}

// Create creates a new entity
func (r *BaseRepositoryImpl[T]) Create(ctx context.Context, entity *T) error {
	return r.db.WithContext(ctx).Create(entity).Error
}

// CreateBatch creates multiple entities in a single transaction
func (r *BaseRepositoryImpl[T]) CreateBatch(ctx context.Context, entities []*T) error {
	if len(entities) == 0 {
		return nil
	}

	// Convert slice of pointers to slice of values
	values := make([]T, len(entities))
	for i, entity := range entities {
		values[i] = *entity
	}

	return r.db.WithContext(ctx).CreateInBatches(values, 100).Error
}

// GetByID retrieves an entity by string ID
func (r *BaseRepositoryImpl[T]) GetByID(ctx context.Context, id string) (*T, error) {
	var entity T
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

// GetByUUID retrieves an entity by UUID
func (r *BaseRepositoryImpl[T]) GetByUUID(ctx context.Context, id string) (*T, error) {
	uuidID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid UUID: %w", err)
	}

	var entity T
	err = r.db.WithContext(ctx).Where("id = ?", uuidID).First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

// Update updates an entity
func (r *BaseRepositoryImpl[T]) Update(ctx context.Context, entity *T) error {
	return r.db.WithContext(ctx).Save(entity).Error
}

// UpdateFields updates specific fields of an entity
func (r *BaseRepositoryImpl[T]) UpdateFields(ctx context.Context, id string, fields map[string]any) error {
	return r.db.WithContext(ctx).Model(r.model).Where("id = ?", id).Updates(fields).Error
}

// Delete deletes an entity
func (r *BaseRepositoryImpl[T]) Delete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(r.model, "id = ?", id).Error
}

// DeleteBatch deletes multiple entities
func (r *BaseRepositoryImpl[T]) DeleteBatch(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Delete(r.model, "id IN ?", ids).Error
}

// SoftDelete performs a soft delete
func (r *BaseRepositoryImpl[T]) SoftDelete(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(r.model, "id = ?", id).Error
}

// Restore restores a soft-deleted entity
func (r *BaseRepositoryImpl[T]) Restore(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Unscoped().Model(r.model).Where("id = ?", id).Update("deleted_at", nil).Error
}

// List returns a paginated list of entities
func (r *BaseRepositoryImpl[T]) List(ctx context.Context, pagination Pagination) (PaginatedResult[T], error) {
	var entities []T
	var total int64

	// Build query
	query := r.db.WithContext(ctx).Model(r.model)

	// Count total records
	if err := query.Count(&total).Error; err != nil {
		return PaginatedResult[T]{}, err
	}

	// Apply pagination and ordering
	if pagination.SortBy != "" {
		orderDirection := "ASC"
		if pagination.SortDesc {
			orderDirection = "DESC"
		}
		query = query.Order(fmt.Sprintf("%s %s", pagination.SortBy, orderDirection))
	}

	// Get paginated results
	if err := query.Offset(pagination.Offset()).Limit(pagination.Limit()).Find(&entities).Error; err != nil {
		return PaginatedResult[T]{}, err
	}

	return NewPaginatedResult(entities, total, pagination), nil
}

// ListWithOptions returns a paginated list with additional query options
func (r *BaseRepositoryImpl[T]) ListWithOptions(ctx context.Context, pagination Pagination, opts QueryOptions) (PaginatedResult[T], error) {
	var entities []T
	var total int64

	// Build query with options
	query := r.buildQuery(ctx, opts)

	// Count total records
	if err := query.Count(&total).Error; err != nil {
		return PaginatedResult[T]{}, err
	}

	// Reset query for data retrieval
	query = r.buildQuery(ctx, opts)

	// Apply pagination and ordering
	if pagination.SortBy != "" {
		orderDirection := "ASC"
		if pagination.SortDesc {
			orderDirection = "DESC"
		}
		query = query.Order(fmt.Sprintf("%s %s", pagination.SortBy, orderDirection))
	}

	// Get paginated results
	if err := query.Offset(pagination.Offset()).Limit(pagination.Limit()).Find(&entities).Error; err != nil {
		return PaginatedResult[T]{}, err
	}

	return NewPaginatedResult(entities, total, pagination), nil
}

// Count returns the count of entities matching the options
func (r *BaseRepositoryImpl[T]) Count(ctx context.Context, opts QueryOptions) (int64, error) {
	query := r.buildQuery(ctx, opts)
	var count int64
	err := query.Count(&count).Error
	return count, err
}

// Exists checks if an entity exists
func (r *BaseRepositoryImpl[T]) Exists(ctx context.Context, id string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(r.model).Where("id = ?", id).Count(&count).Error
	return count > 0, err
}

// FindOne finds a single entity matching the options
func (r *BaseRepositoryImpl[T]) FindOne(ctx context.Context, opts QueryOptions) (*T, error) {
	var entity T
	query := r.buildQuery(ctx, opts)
	err := query.First(&entity).Error
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

// FindMany finds multiple entities matching the options
func (r *BaseRepositoryImpl[T]) FindMany(ctx context.Context, opts QueryOptions) ([]T, error) {
	var entities []T
	query := r.buildQuery(ctx, opts)
	err := query.Find(&entities).Error
	return entities, err
}

// WithTx returns a new repository instance with the given transaction
func (r *BaseRepositoryImpl[T]) WithTx(tx *gorm.DB) BaseRepository[T] {
	return &BaseRepositoryImpl[T]{
		db:    tx,
		model: r.model,
	}
}

// buildQuery builds a query with the given options
func (r *BaseRepositoryImpl[T]) buildQuery(ctx context.Context, opts QueryOptions) *gorm.DB {
	query := r.db.WithContext(ctx).Model(r.model)

	// Handle raw query
	if opts.RawQuery != "" {
		query = query.Raw(opts.RawQuery, opts.RawArgs...)
		return query
	}

	// Apply tenant filtering
	if opts.TenantID != "" {
		query = query.Where("tenant_id = ?", opts.TenantID)
	}

	// Apply user filtering
	if opts.UserID != "" {
		query = query.Where("user_id = ?", opts.UserID)
	}

	// Apply filters
	for key, value := range opts.Filters {
		query = query.Where(key+" = ?", value)
	}

	// Apply select clause
	if opts.Select != "" {
		query = query.Select(opts.Select)
	}

	// Apply omit clause
	if opts.Omit != "" {
		query = query.Omit(opts.Omit)
	}

	// Apply preloads
	for _, preload := range opts.Preloads {
		query = query.Preload(preload)
	}

	// Apply having clause
	for key, value := range opts.Having {
		query = query.Having(key+" = ?", value)
	}

	// Apply group by
	if opts.Group != "" {
		query = query.Group(opts.Group)
	}

	// Apply distinct
	if opts.Distinct {
		query = query.Distinct()
	}

	// Apply unscoped (for soft deletes)
	if opts.Unscoped {
		query = query.Unscoped()
	}

	return query
}

// TenantRepositoryImpl implements TenantRepository
type TenantRepositoryImpl struct {
	*BaseRepositoryImpl[models.Tenant]
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository(db *gorm.DB) TenantRepository {
	base := NewBaseRepository[models.Tenant](db)
	return &TenantRepositoryImpl{
		BaseRepositoryImpl: base.(*BaseRepositoryImpl[models.Tenant]),
	}
}

// GetByDomain retrieves a tenant by domain
func (r *TenantRepositoryImpl) GetByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	var tenant models.Tenant
	err := r.db.WithContext(ctx).Where("domain = ?", domain).First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

// GetActiveTenants retrieves all active tenants
func (r *TenantRepositoryImpl) GetActiveTenants(ctx context.Context) ([]models.Tenant, error) {
	var tenants []models.Tenant
	err := r.db.WithContext(ctx).Where("status = ?", "active").Find(&tenants).Error
	return tenants, err
}

// GetTenantsBySubscription retrieves tenants by subscription tier
func (r *TenantRepositoryImpl) GetTenantsBySubscription(ctx context.Context, tier string) ([]models.Tenant, error) {
	var tenants []models.Tenant
	err := r.db.WithContext(ctx).Where("subscription_tier = ?", tier).Find(&tenants).Error
	return tenants, err
}

// UpdateStatus updates tenant status
func (r *TenantRepositoryImpl) UpdateStatus(ctx context.Context, id string, status string) error {
	return r.db.WithContext(ctx).Model(&models.Tenant{}).Where("id = ?", id).Update("status", status).Error
}

// GetTenantStatistics retrieves tenant statistics
func (r *TenantRepositoryImpl) GetTenantStatistics(ctx context.Context, tenantID string) (*TenantStats, error) {
	stats := &TenantStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get user counts
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalUsers).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActiveUsers).Error; err != nil {
		return nil, err
	}

	// Get document counts
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalDocuments).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ? AND processing_status = ?", tenantUUID, "completed").
		Count(&stats.ProcessedDocuments).Error; err != nil {
		return nil, err
	}

	// Get storage usage
	var totalStorage int64
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ?", tenantUUID).
		Select("COALESCE(SUM(file_size), 0)").
		Scan(&totalStorage).Error; err != nil {
		return nil, err
	}
	stats.TotalStorage = totalStorage

	// Get API key counts
	if err := r.db.WithContext(ctx).Model(&models.APIKey{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActiveAPIKeys).Error; err != nil {
		return nil, err
	}

	// Get policy counts
	if err := r.db.WithContext(ctx).Model(&models.Policy{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActivePolicies).Error; err != nil {
		return nil, err
	}

	// Get last activity
	var lastActivity time.Time
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ?", tenantUUID).
		Order("created_at DESC").
		Limit(1).
		Pluck("created_at", &lastActivity).Error; err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	stats.LastActivity = lastActivity

	return stats, nil
}

// CheckResourceLimits checks if tenant has exceeded resource limits
func (r *TenantRepositoryImpl) CheckResourceLimits(ctx context.Context, tenantID string, resourceType string) (bool, error) {
	// This would involve checking tenant's resource_limits JSON field
	// For now, return true (within limits)
	return true, nil
}

// UpdateConfig updates tenant configuration
func (r *TenantRepositoryImpl) UpdateConfig(ctx context.Context, id string, config map[string]any) error {
	return r.db.WithContext(ctx).Model(&models.Tenant{}).
		Where("id = ?", id).
		Update("config", config).Error
}

// UpdateSettings updates tenant settings
func (r *TenantRepositoryImpl) UpdateSettings(ctx context.Context, id string, settings map[string]any) error {
	return r.db.WithContext(ctx).Model(&models.Tenant{}).
		Where("id = ?", id).
		Update("settings", settings).Error
}

// GetTenantConfig retrieves tenant configuration
func (r *TenantRepositoryImpl) GetTenantConfig(ctx context.Context, tenantID string) (map[string]any, error) {
	var config map[string]any
	err := r.db.WithContext(ctx).Model(&models.Tenant{}).
		Where("id = ?", tenantID).
		Pluck("config", &config).Error
	return config, err
}

// UserRepositoryImpl implements UserRepository
type UserRepositoryImpl struct {
	*BaseRepositoryImpl[models.User]
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) UserRepository {
	base := NewBaseRepository[models.User](db)
	return &UserRepositoryImpl{
		BaseRepositoryImpl: base.(*BaseRepositoryImpl[models.User]),
	}
}

// GetByEmail retrieves a user by email within a tenant
func (r *UserRepositoryImpl) GetByEmail(ctx context.Context, tenantID, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND email = ?", tenantID, email).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmailOnly retrieves a user by email (across all tenants - use with caution)
func (r *UserRepositoryImpl) GetByEmailOnly(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetBySessionToken retrieves a user by session token
func (r *UserRepositoryImpl) GetBySessionToken(ctx context.Context, token string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).
		Joins("JOIN user_sessions ON users.id = user_sessions.user_id").
		Where("user_sessions.token = ? AND user_sessions.expires_at > NOW() AND user_sessions.is_active = ?", token, true).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUsersByTenant retrieves paginated users for a tenant
func (r *UserRepositoryImpl) GetUsersByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.User], error) {
	opts := QueryOptions{
		TenantID: tenantID,
		Preloads: []string{},
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetUsersByRole retrieves users by role within a tenant
func (r *UserRepositoryImpl) GetUsersByRole(ctx context.Context, tenantID, role string) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND role = ?", tenantID, role).
		Find(&users).Error
	return users, err
}

// GetActiveUsers retrieves active users for a tenant
func (r *UserRepositoryImpl) GetActiveUsers(ctx context.Context, tenantID string) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Find(&users).Error
	return users, err
}

// UpdatePassword updates user password
func (r *UserRepositoryImpl) UpdatePassword(ctx context.Context, userID string, hashedPassword string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"password_hash": hashedPassword,
			"updated_at":    time.Now(),
		}).Error
}

// UpdateLastLogin updates user's last login timestamp
func (r *UserRepositoryImpl) UpdateLastLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("last_login", time.Now()).Error
}

// LockUser locks a user account
func (r *UserRepositoryImpl) LockUser(ctx context.Context, userID string, duration time.Duration) error {
	lockUntil := time.Now().Add(duration)
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("locked_until", lockUntil).Error
}

// UnlockUser unlocks a user account
func (r *UserRepositoryImpl) UnlockUser(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"locked_until":          nil,
			"failed_login_attempts": 0,
		}).Error
}

// IncrementFailedLogin increments failed login count
func (r *UserRepositoryImpl) IncrementFailedLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("failed_login_attempts", gorm.Expr("failed_login_attempts + 1")).Error
}

// ResetFailedLogin resets failed login count
func (r *UserRepositoryImpl) ResetFailedLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("failed_login_attempts", 0).Error
}

// VerifyEmail marks email as verified
func (r *UserRepositoryImpl) VerifyEmail(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Update("email_verified", true).Error
}

// EnableMFA enables multi-factor authentication
func (r *UserRepositoryImpl) EnableMFA(ctx context.Context, userID string, secret []byte) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"mfa_enabled": true,
			"mfa_secret":  secret,
		}).Error
}

// DisableMFA disables multi-factor authentication
func (r *UserRepositoryImpl) DisableMFA(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"mfa_enabled": false,
			"mfa_secret":  nil,
		}).Error
}

// GetUserStatistics retrieves user statistics for a tenant
func (r *UserRepositoryImpl) GetUserStatistics(ctx context.Context, tenantID string) (*UserStats, error) {
	stats := &UserStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get total users
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalUsers).Error; err != nil {
		return nil, err
	}

	// Get active users
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND is_active = ?", tenantUUID, true).
		Count(&stats.ActiveUsers).Error; err != nil {
		return nil, err
	}

	// Get locked users
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND locked_until > NOW()", tenantUUID).
		Count(&stats.LockedUsers).Error; err != nil {
		return nil, err
	}

	// Get email verified users
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND email_verified = ?", tenantUUID, true).
		Count(&stats.EmailVerified).Error; err != nil {
		return nil, err
	}

	// Get MFA enabled users
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND mfa_enabled = ?", tenantUUID, true).
		Count(&stats.MFAEnabled).Error; err != nil {
		return nil, err
	}

	// Get failed logins today
	if err := r.db.WithContext(ctx).Model(&models.AuditLog{}).
		Where("tenant_id = ? AND action = ? AND created_at >= DATE(NOW())", tenantUUID, "login").
		Count(&stats.FailedLogins).Error; err != nil {
		return nil, err
	}

	// Get new users today
	if err := r.db.WithContext(ctx).Model(&models.User{}).
		Where("tenant_id = ? AND created_at >= DATE(NOW())", tenantUUID).
		Count(&stats.NewUsers).Error; err != nil {
		return nil, err
	}

	return stats, nil
}

// GetUserActivity retrieves user activity from audit logs
func (r *UserRepositoryImpl) GetUserActivity(ctx context.Context, userID string, timeRange time.Duration) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	since := time.Now().Add(-timeRange)

	err := r.db.WithContext(ctx).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Order("created_at DESC").
		Find(&logs).Error

	return logs, err
}
