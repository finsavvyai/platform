package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
)

// PolicyRepository implements the PolicyRepository interface for PostgreSQL
type PolicyRepository struct {
	pool   *pgxpool.Pool
	logger *logrus.Logger
}

// NewPolicyRepository creates a new policy repository
func NewPolicyRepository(pool *pgxpool.Pool, logger *logrus.Logger) *PolicyRepository {
	if logger == nil {
		logger = logrus.New()
	}

	return &PolicyRepository{
		pool:   pool,
		logger: logger,
	}
}

// GetPolicy retrieves a policy by tenant ID and name
func (r *PolicyRepository) GetPolicy(ctx context.Context, tenantID uuid.UUID, name string) ([]byte, error) {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "GetPolicy")
	defer span.End()

	query := `
		SELECT policy_data
		FROM policies
		WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL
	`

	var policyData []byte
	err := r.pool.QueryRow(ctx, query, tenantID, name).Scan(&policyData)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("policy not found: tenant_id=%s, name=%s", tenantID, name)
		}
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"name":      name,
	}).Debug("Policy retrieved successfully")

	return policyData, nil
}

// SavePolicy saves or updates a policy
func (r *PolicyRepository) SavePolicy(ctx context.Context, tenantID uuid.UUID, name string, data []byte) error {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "SavePolicy")
	defer span.End()

	query := `
		INSERT INTO policies (tenant_id, name, policy_data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $4)
		ON CONFLICT (tenant_id, name)
		DO UPDATE SET
			policy_data = EXCLUDED.policy_data,
			updated_at = $4
	`

	now := time.Now()
	_, err := r.pool.Exec(ctx, query, tenantID, name, data, now)
	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"name":      name,
			"error":     err,
		}).Error("Failed to save policy")
		return fmt.Errorf("failed to save policy: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"name":      name,
	}).Info("Policy saved successfully")

	return nil
}

// DeletePolicy soft deletes a policy
func (r *PolicyRepository) DeletePolicy(ctx context.Context, tenantID uuid.UUID, name string) error {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "DeletePolicy")
	defer span.End()

	query := `
		UPDATE policies
		SET deleted_at = $1
		WHERE tenant_id = $2 AND name = $3
	`

	now := time.Now()
	result, err := r.pool.Exec(ctx, query, now, tenantID, name)
	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"name":      name,
			"error":     err,
		}).Error("Failed to delete policy")
		return fmt.Errorf("failed to delete policy: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("policy not found: tenant_id=%s, name=%s", tenantID, name)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"name":      name,
	}).Info("Policy deleted successfully")

	return nil
}

// ListPolicies lists all policy names for a tenant
func (r *PolicyRepository) ListPolicies(ctx context.Context, tenantID uuid.UUID) ([]string, error) {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "ListPolicies")
	defer span.End()

	query := `
		SELECT name
		FROM policies
		WHERE tenant_id = $1 AND deleted_at IS NULL
		ORDER BY name ASC
	`

	rows, err := r.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan policy name: %w", err)
		}
		names = append(names, name)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating policies: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id":    tenantID,
		"policy_count": len(names),
	}).Debug("Policies listed successfully")

	return names, nil
}

// GetPolicyWithMetadata retrieves a policy with its metadata
func (r *PolicyRepository) GetPolicyWithMetadata(ctx context.Context, tenantID uuid.UUID, name string) (*PolicyMetadata, error) {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "GetPolicyWithMetadata")
	defer span.End()

	query := `
		SELECT id, tenant_id, name, description, policy_type, policy_data,
		       version, is_active, created_at, updated_at, created_by, checksum
		FROM policies
		WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL
	`

	var metadata PolicyMetadata
	err := r.pool.QueryRow(ctx, query, tenantID, name).Scan(
		&metadata.ID,
		&metadata.TenantID,
		&metadata.Name,
		&metadata.Description,
		&metadata.PolicyType,
		&metadata.PolicyData,
		&metadata.Version,
		&metadata.IsActive,
		&metadata.CreatedAt,
		&metadata.UpdatedAt,
		&metadata.CreatedBy,
		&metadata.Checksum,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("policy not found: tenant_id=%s, name=%s", tenantID, name)
		}
		return nil, fmt.Errorf("failed to get policy metadata: %w", err)
	}

	return &metadata, nil
}

// ListPoliciesWithMetadata lists all policies with metadata for a tenant
func (r *PolicyRepository) ListPoliciesWithMetadata(ctx context.Context, tenantID uuid.UUID) ([]*PolicyMetadata, error) {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "ListPoliciesWithMetadata")
	defer span.End()

	query := `
		SELECT id, tenant_id, name, description, policy_type, policy_data,
		       version, is_active, created_at, updated_at, created_by, checksum
		FROM policies
		WHERE tenant_id = $1 AND deleted_at IS NULL
		ORDER BY name ASC
	`

	rows, err := r.pool.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies with metadata: %w", err)
	}
	defer rows.Close()

	var policies []*PolicyMetadata
	for rows.Next() {
		var metadata PolicyMetadata
		if err := rows.Scan(
			&metadata.ID,
			&metadata.TenantID,
			&metadata.Name,
			&metadata.Description,
			&metadata.PolicyType,
			&metadata.PolicyData,
			&metadata.Version,
			&metadata.IsActive,
			&metadata.CreatedAt,
			&metadata.UpdatedAt,
			&metadata.CreatedBy,
			&metadata.Checksum,
		); err != nil {
			return nil, fmt.Errorf("failed to scan policy metadata: %w", err)
		}
		policies = append(policies, &metadata)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating policies: %w", err)
	}

	return policies, nil
}

// CreatePolicy creates a new policy with full metadata
func (r *PolicyRepository) CreatePolicy(ctx context.Context, policy *PolicyMetadata) error {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "CreatePolicy")
	defer span.End()

	query := `
		INSERT INTO policies (
			id, tenant_id, name, description, policy_type, policy_data,
			version, is_active, created_at, updated_at, created_by, checksum
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	now := time.Now()
	policy.ID = uuid.New()
	policy.CreatedAt = now
	policy.UpdatedAt = now

	_, err := r.pool.Exec(ctx, query,
		policy.ID,
		policy.TenantID,
		policy.Name,
		policy.Description,
		policy.PolicyType,
		policy.PolicyData,
		policy.Version,
		policy.IsActive,
		policy.CreatedAt,
		policy.UpdatedAt,
		policy.CreatedBy,
		policy.Checksum,
	)

	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"tenant_id": policy.TenantID,
			"name":      policy.Name,
			"error":     err,
		}).Error("Failed to create policy")
		return fmt.Errorf("failed to create policy: %w", err)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": policy.TenantID,
		"name":      policy.Name,
		"policy_id": policy.ID,
	}).Info("Policy created successfully")

	return nil
}

// UpdatePolicy updates an existing policy
func (r *PolicyRepository) UpdatePolicy(ctx context.Context, tenantID uuid.UUID, name string, updates *PolicyUpdate) error {
	ctx, span := otel.Tracer("policy-repository").Start(ctx, "UpdatePolicy")
	defer span.End()

	setParts := []string{"updated_at = $1"}
	args := []interface{}{time.Now()}
	argIndex := 2

	if updates.Description != nil {
		setParts = append(setParts, fmt.Sprintf("description = $%d", argIndex))
		args = append(args, *updates.Description)
		argIndex++
	}

	if updates.PolicyData != nil {
		setParts = append(setParts, fmt.Sprintf("policy_data = $%d", argIndex))
		args = append(args, updates.PolicyData)
		argIndex++
	}

	if updates.PolicyType != nil {
		setParts = append(setParts, fmt.Sprintf("policy_type = $%d", argIndex))
		args = append(args, *updates.PolicyType)
		argIndex++
	}

	if updates.Version != nil {
		setParts = append(setParts, fmt.Sprintf("version = $%d", argIndex))
		args = append(args, *updates.Version)
		argIndex++
	}

	if updates.IsActive != nil {
		setParts = append(setParts, fmt.Sprintf("is_active = $%d", argIndex))
		args = append(args, *updates.IsActive)
		argIndex++
	}

	if updates.Checksum != nil {
		setParts = append(setParts, fmt.Sprintf("checksum = $%d", argIndex))
		args = append(args, *updates.Checksum)
		argIndex++
	}

	args = append(args, tenantID, name)

	query := fmt.Sprintf(`
		UPDATE policies
		SET %s
		WHERE tenant_id = $%d AND name = $%d
	`, fmt.Sprintf("%s", setParts), argIndex, argIndex+1)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		r.logger.WithFields(logrus.Fields{
			"tenant_id": tenantID,
			"name":      name,
			"error":     err,
		}).Error("Failed to update policy")
		return fmt.Errorf("failed to update policy: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("policy not found: tenant_id=%s, name=%s", tenantID, name)
	}

	r.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"name":      name,
	}).Info("Policy updated successfully")

	return nil
}

// ActivatePolicy activates a policy
func (r *PolicyRepository) ActivatePolicy(ctx context.Context, tenantID uuid.UUID, name string) error {
	return r.UpdatePolicy(ctx, tenantID, name, &PolicyUpdate{
		IsActive: boolPtr(true),
	})
}

// DeactivatePolicy deactivates a policy
func (r *PolicyRepository) DeactivatePolicy(ctx context.Context, tenantID uuid.UUID, name string) error {
	return r.UpdatePolicy(ctx, tenantID, name, &PolicyUpdate{
		IsActive: boolPtr(false),
	})
}

// HealthCheck performs a health check on the policy repository
func (r *PolicyRepository) HealthCheck(ctx context.Context) error {
	query := `
		SELECT COUNT(*)
		FROM policies
		WHERE deleted_at IS NULL
	`

	var count int
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return fmt.Errorf("policy repository health check failed: %w", err)
	}

	r.logger.WithField("total_policies", count).Debug("Policy repository health check passed")
	return nil
}

// GetPolicyStats returns statistics about policies for a tenant
func (r *PolicyRepository) GetPolicyStats(ctx context.Context, tenantID uuid.UUID) (*PolicyStats, error) {
	query := `
		SELECT
			COUNT(*) as total_policies,
			COUNT(*) FILTER (WHERE is_active = true) as active_policies,
			COUNT(*) FILTER (WHERE policy_type = 'opa') as opa_policies,
			COUNT(*) FILTER (WHERE policy_type = 'iam') as iam_policies
		FROM policies
		WHERE tenant_id = $1 AND deleted_at IS NULL
	`

	var stats PolicyStats
	err := r.pool.QueryRow(ctx, query, tenantID).Scan(
		&stats.TotalPolicies,
		&stats.ActivePolicies,
		&stats.OPAPolicies,
		&stats.IAMPolicies,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get policy stats: %w", err)
	}

	return &stats, nil
}

// Helper function

func boolPtr(b bool) *bool {
	return &b
}

// PolicyMetadata represents full policy metadata
type PolicyMetadata struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	PolicyType  string    `json:"policy_type"`
	PolicyData  []byte    `json:"policy_data"`
	Version     int       `json:"version"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   uuid.UUID `json:"created_by"`
	Checksum    string    `json:"checksum,omitempty"`
}

// PolicyUpdate represents fields that can be updated
type PolicyUpdate struct {
	Description *string `json:"description,omitempty"`
	PolicyData  []byte  `json:"policy_data,omitempty"`
	PolicyType  *string `json:"policy_type,omitempty"`
	Version     *int    `json:"version,omitempty"`
	IsActive    *bool   `json:"is_active,omitempty"`
	Checksum    *string `json:"checksum,omitempty"`
}

// PolicyStats represents policy statistics
type PolicyStats struct {
	TotalPolicies  int `json:"total_policies"`
	ActivePolicies int `json:"active_policies"`
	OPAPolicies    int `json:"opa_policies"`
	IAMPolicies    int `json:"iam_policies"`
}

// InitializeSchema creates the policies table if it doesn't exist
func (r *PolicyRepository) InitializeSchema(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS policies (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			policy_type VARCHAR(50) NOT NULL DEFAULT 'opa',
			policy_data BYTEA NOT NULL,
			version INTEGER NOT NULL DEFAULT 1,
			is_active BOOLEAN NOT NULL DEFAULT true,
			checksum VARCHAR(64),
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMP,
			created_by UUID NOT NULL,
			CONSTRAINT policies_tenant_name_key UNIQUE (tenant_id, name)
		);

		CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
		CREATE INDEX IF NOT EXISTS idx_policies_type ON policies(policy_type);
		CREATE INDEX IF NOT EXISTS idx_policies_active ON policies(is_active);
		CREATE INDEX IF NOT EXISTS idx_policies_deleted_at ON policies(deleted_at);
	`

	_, err := r.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to initialize policies schema: %w", err)
	}

	r.logger.Info("Policies schema initialized successfully")
	return nil
}
