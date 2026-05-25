package repositories

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	domainrepo "github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// tenantRepository implements TenantRepository
type tenantRepository struct {
	pool   *pgxpool.Pool
	logger *logrus.Logger
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository(pool *pgxpool.Pool) domainrepo.TenantRepository {
	return &tenantRepository{
		pool:   pool,
		logger: logrus.New(),
	}
}

// Create creates a new tenant
func (r *tenantRepository) Create(ctx context.Context, tenant *models.Tenant) error {
	query := `
		INSERT INTO tenants (
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		)
	`

	_, err := r.pool.Exec(ctx, query,
		tenant.ID, tenant.Name, tenant.Domain, tenant.Status,
		tenant.Config, tenant.Settings, tenant.SubscriptionTier,
		tenant.DataRegion, tenant.ContactEmail, tenant.BillingInfo,
		tenant.CreatedAt, tenant.UpdatedAt, tenant.Metadata,
		tenant.RetentionPolicy, tenant.ResourceLimits,
		tenant.ComplianceRequirements,
	)

	if err != nil {
		r.logger.WithError(err).Error("Failed to create tenant")
		return fmt.Errorf("failed to create tenant: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": tenant.ID,
		"name":      tenant.Name,
		"domain":    tenant.Domain,
	}).Info("Tenant created successfully")

	return nil
}

// GetByID retrieves a tenant by ID
func (r *tenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Tenant, error) {
	query := `
		SELECT
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		FROM tenants
		WHERE id = $1
	`

	var tenant models.Tenant
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.Status,
		&tenant.Config, &tenant.Settings, &tenant.SubscriptionTier,
		&tenant.DataRegion, &tenant.ContactEmail, &tenant.BillingInfo,
		&tenant.CreatedAt, &tenant.UpdatedAt, &tenant.Metadata,
		&tenant.RetentionPolicy, &tenant.ResourceLimits,
		&tenant.ComplianceRequirements,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("tenant not found: %s", id)
		}
		r.logger.WithError(err).WithField("tenant_id", id).Error("Failed to get tenant")
		return nil, fmt.Errorf("failed to get tenant: %w", err)
	}

	return &tenant, nil
}

// Update updates a tenant
func (r *tenantRepository) Update(ctx context.Context, id uuid.UUID, updates interface{}) error {
	update, ok := updates.(models.TenantUpdate)
	if !ok {
		return fmt.Errorf("invalid update type, expected TenantUpdate")
	}

	// Build dynamic update query
	setParts := []string{}
	args := []interface{}{}
	argIndex := 1

	if update.Name != nil {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, *update.Name)
		argIndex++
	}
	if update.Status != nil {
		setParts = append(setParts, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, *update.Status)
		argIndex++
	}
	if update.Config != nil {
		setParts = append(setParts, fmt.Sprintf("config = $%d", argIndex))
		args = append(args, *update.Config)
		argIndex++
	}
	if update.Settings != nil {
		setParts = append(setParts, fmt.Sprintf("settings = $%d", argIndex))
		args = append(args, *update.Settings)
		argIndex++
	}
	if update.SubscriptionTier != nil {
		setParts = append(setParts, fmt.Sprintf("subscription_tier = $%d", argIndex))
		args = append(args, *update.SubscriptionTier)
		argIndex++
	}
	if update.DataRegion != nil {
		setParts = append(setParts, fmt.Sprintf("data_region = $%d", argIndex))
		args = append(args, *update.DataRegion)
		argIndex++
	}
	if update.ContactEmail != nil {
		setParts = append(setParts, fmt.Sprintf("contact_email = $%d", argIndex))
		args = append(args, *update.ContactEmail)
		argIndex++
	}
	if update.BillingInfo != nil {
		setParts = append(setParts, fmt.Sprintf("billing_info = $%d", argIndex))
		args = append(args, *update.BillingInfo)
		argIndex++
	}
	if update.Metadata != nil {
		setParts = append(setParts, fmt.Sprintf("metadata = $%d", argIndex))
		args = append(args, *update.Metadata)
		argIndex++
	}
	if update.RetentionPolicy != nil {
		setParts = append(setParts, fmt.Sprintf("retention_policy = $%d", argIndex))
		args = append(args, *update.RetentionPolicy)
		argIndex++
	}
	if update.ResourceLimits != nil {
		setParts = append(setParts, fmt.Sprintf("resource_limits = $%d", argIndex))
		args = append(args, *update.ResourceLimits)
		argIndex++
	}
	if update.ComplianceRequirements != nil {
		setParts = append(setParts, fmt.Sprintf("compliance_requirements = $%d", argIndex))
		args = append(args, *update.ComplianceRequirements)
		argIndex++
	}

	if len(setParts) == 0 {
		return nil // No updates to apply
	}

	// Always update updated_at
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE tenants
		SET %s
		WHERE id = $%d
	`, strings.Join(setParts, ", "), argIndex)

	_, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		r.logger.WithError(err).WithField("tenant_id", id).Error("Failed to update tenant")
		return fmt.Errorf("failed to update tenant: %w", err)
	}

	r.logger.WithField("tenant_id", id).Info("Tenant updated successfully")
	return nil
}

// Delete soft deletes a tenant
func (r *tenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE tenants SET status = 'deleted', updated_at = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, time.Now(), id)
	if err != nil {
		r.logger.WithError(err).WithField("tenant_id", id).Error("Failed to delete tenant")
		return fmt.Errorf("failed to delete tenant: %w", err)
	}

	r.logger.WithField("tenant_id", id).Info("Tenant deleted successfully")
	return nil
}

// List retrieves tenants with filtering and pagination
func (r *tenantRepository) List(ctx context.Context, filter interface{}, limit, offset int) ([]*models.Tenant, error) {
	tenantFilter, ok := filter.(models.TenantFilter)
	if !ok {
		tenantFilter = models.TenantFilter{}
	}

	whereParts := []string{"1=1"}
	args := []interface{}{}
	argIndex := 1

	if tenantFilter.Status != nil {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, *tenantFilter.Status)
		argIndex++
	}
	if tenantFilter.SubscriptionTier != nil {
		whereParts = append(whereParts, fmt.Sprintf("subscription_tier = $%d", argIndex))
		args = append(args, *tenantFilter.SubscriptionTier)
		argIndex++
	}
	if tenantFilter.DataRegion != nil {
		whereParts = append(whereParts, fmt.Sprintf("data_region = $%d", argIndex))
		args = append(args, *tenantFilter.DataRegion)
		argIndex++
	}

	query := fmt.Sprintf(`
		SELECT
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		FROM tenants
		WHERE %s
		ORDER BY created_at DESC
	`, strings.Join(whereParts, " AND "))

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIndex)
		args = append(args, limit)
		argIndex++
	}

	if offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIndex)
		args = append(args, offset)
		argIndex++
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		r.logger.WithError(err).Error("Failed to list tenants")
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	defer rows.Close()

	var tenants []*models.Tenant
	for rows.Next() {
		var tenant models.Tenant
		err := rows.Scan(
			&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.Status,
			&tenant.Config, &tenant.Settings, &tenant.SubscriptionTier,
			&tenant.DataRegion, &tenant.ContactEmail, &tenant.BillingInfo,
			&tenant.CreatedAt, &tenant.UpdatedAt, &tenant.Metadata,
			&tenant.RetentionPolicy, &tenant.ResourceLimits,
			&tenant.ComplianceRequirements,
		)
		if err != nil {
			r.logger.WithError(err).Error("Failed to scan tenant row")
			return nil, fmt.Errorf("failed to scan tenant row: %w", err)
		}
		tenants = append(tenants, &tenant)
	}

	return tenants, nil
}

// Count returns the total number of tenants
func (r *tenantRepository) Count(ctx context.Context, filter interface{}) (int, error) {
	tenantFilter, ok := filter.(models.TenantFilter)
	if !ok {
		tenantFilter = models.TenantFilter{}
	}

	whereParts := []string{"1=1"}
	args := []interface{}{}
	argIndex := 1

	if tenantFilter.Status != nil {
		whereParts = append(whereParts, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, *tenantFilter.Status)
		argIndex++
	}
	if tenantFilter.SubscriptionTier != nil {
		whereParts = append(whereParts, fmt.Sprintf("subscription_tier = $%d", argIndex))
		args = append(args, *tenantFilter.SubscriptionTier)
		argIndex++
	}
	if tenantFilter.DataRegion != nil {
		whereParts = append(whereParts, fmt.Sprintf("data_region = $%d", argIndex))
		args = append(args, *tenantFilter.DataRegion)
		argIndex++
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM tenants
		WHERE %s
	`, strings.Join(whereParts, " AND "))

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		r.logger.WithError(err).Error("Failed to count tenants")
		return 0, fmt.Errorf("failed to count tenants: %w", err)
	}

	return count, nil
}

// GetByDomain retrieves a tenant by domain
func (r *tenantRepository) GetByDomain(ctx context.Context, domain string) (*models.Tenant, error) {
	query := `
		SELECT
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		FROM tenants
		WHERE domain = $1
	`

	var tenant models.Tenant
	err := r.pool.QueryRow(ctx, query, domain).Scan(
		&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.Status,
		&tenant.Config, &tenant.Settings, &tenant.SubscriptionTier,
		&tenant.DataRegion, &tenant.ContactEmail, &tenant.BillingInfo,
		&tenant.CreatedAt, &tenant.UpdatedAt, &tenant.Metadata,
		&tenant.RetentionPolicy, &tenant.ResourceLimits,
		&tenant.ComplianceRequirements,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("tenant not found for domain: %s", domain)
		}
		r.logger.WithError(err).WithField("domain", domain).Error("Failed to get tenant by domain")
		return nil, fmt.Errorf("failed to get tenant by domain: %w", err)
	}

	return &tenant, nil
}

// GetActive retrieves all active tenants
func (r *tenantRepository) GetActive(ctx context.Context) ([]*models.Tenant, error) {
	query := `
		SELECT
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		FROM tenants
		WHERE status = 'active'
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		r.logger.WithError(err).Error("Failed to get active tenants")
		return nil, fmt.Errorf("failed to get active tenants: %w", err)
	}
	defer rows.Close()

	var tenants []*models.Tenant
	for rows.Next() {
		var tenant models.Tenant
		err := rows.Scan(
			&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.Status,
			&tenant.Config, &tenant.Settings, &tenant.SubscriptionTier,
			&tenant.DataRegion, &tenant.ContactEmail, &tenant.BillingInfo,
			&tenant.CreatedAt, &tenant.UpdatedAt, &tenant.Metadata,
			&tenant.RetentionPolicy, &tenant.ResourceLimits,
			&tenant.ComplianceRequirements,
		)
		if err != nil {
			r.logger.WithError(err).Error("Failed to scan tenant row")
			return nil, fmt.Errorf("failed to scan tenant row: %w", err)
		}
		tenants = append(tenants, &tenant)
	}

	return tenants, nil
}

// GetBySubscriptionTier retrieves tenants by subscription tier
func (r *tenantRepository) GetBySubscriptionTier(ctx context.Context, tier string) ([]*models.Tenant, error) {
	query := `
		SELECT
			id, name, domain, status, config, settings, subscription_tier,
			data_region, contact_email, billing_info, created_at, updated_at,
			metadata, retention_policy, resource_limits, compliance_requirements
		FROM tenants
		WHERE subscription_tier = $1 AND status != 'deleted'
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, tier)
	if err != nil {
		r.logger.WithError(err).WithField("tier", tier).Error("Failed to get tenants by tier")
		return nil, fmt.Errorf("failed to get tenants by tier: %w", err)
	}
	defer rows.Close()

	var tenants []*models.Tenant
	for rows.Next() {
		var tenant models.Tenant
		err := rows.Scan(
			&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.Status,
			&tenant.Config, &tenant.Settings, &tenant.SubscriptionTier,
			&tenant.DataRegion, &tenant.ContactEmail, &tenant.BillingInfo,
			&tenant.CreatedAt, &tenant.UpdatedAt, &tenant.Metadata,
			&tenant.RetentionPolicy, &tenant.ResourceLimits,
			&tenant.ComplianceRequirements,
		)
		if err != nil {
			r.logger.WithError(err).Error("Failed to scan tenant row")
			return nil, fmt.Errorf("failed to scan tenant row: %w", err)
		}
		tenants = append(tenants, &tenant)
	}

	return tenants, nil
}

// UpdateStatus updates a tenant's status
func (r *tenantRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.TenantStatus) error {
	query := `UPDATE tenants SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.pool.Exec(ctx, query, status, time.Now(), id)
	if err != nil {
		r.logger.WithError(err).WithFields(logrus.Fields{
			"tenant_id": id,
			"status":    status,
		}).Error("Failed to update tenant status")
		return fmt.Errorf("failed to update tenant status: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": id,
		"status":    status,
	}).Info("Tenant status updated successfully")

	return nil
}

// CheckDomainExists checks if a domain already exists
func (r *tenantRepository) CheckDomainExists(ctx context.Context, domain string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM tenants WHERE domain = $1 AND status != 'deleted')`
	var exists bool
	err := r.pool.QueryRow(ctx, query, domain).Scan(&exists)
	if err != nil {
		r.logger.WithError(err).WithField("domain", domain).Error("Failed to check domain existence")
		return false, fmt.Errorf("failed to check domain existence: %w", err)
	}
	return exists, nil
}

// GetTenantCount returns the total number of tenants
func (r *tenantRepository) GetTenantCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM tenants WHERE status != 'deleted'`
	var count int
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		r.logger.WithError(err).Error("Failed to get tenant count")
		return 0, fmt.Errorf("failed to get tenant count: %w", err)
	}
	return count, nil
}
