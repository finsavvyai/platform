package postgres

import (
	"context"
	"encoding/json"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/jackc/pgx/v5/pgxpool"
)

// enterpriseSettingsRepository implements enterprise settings repository
type enterpriseSettingsRepository struct {
	db *pgxpool.Pool
}

// NewEnterpriseSettingsRepository creates a new PostgreSQL enterprise settings repository
func NewEnterpriseSettingsRepository(db *pgxpool.Pool) sso.EnterpriseSettingsRepository {
	return &enterpriseSettingsRepository{db: db}
}

func (r *enterpriseSettingsRepository) Create(ctx context.Context, settings *sso.EnterpriseSettings) error {
	query := `
		INSERT INTO enterprise_settings (
			id, organization_id, provider_id, require_sso, allow_local_login,
			domain_whitelist, role_mappings, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)`

	roleMappingsJSON, _ := json.Marshal(settings.GetRoleMappings())

	_, err := r.db.Exec(ctx, query,
		settings.ID, settings.OrganizationID, settings.ProviderID,
		settings.RequireSSO, settings.AllowLocalLogin,
		settings.DomainWhitelist, roleMappingsJSON,
		settings.CreatedAt, settings.UpdatedAt,
	)

	return err
}

func (r *enterpriseSettingsRepository) GetByID(ctx context.Context, id string) (*sso.EnterpriseSettings, error) {
	query := `
		SELECT id, organization_id, provider_id, require_sso, allow_local_login,
			   domain_whitelist, role_mappings, created_at, updated_at
		FROM enterprise_settings
		WHERE id = $1`

	var settings sso.EnterpriseSettings
	var roleMappingsJSON []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&settings.ID, &settings.OrganizationID, &settings.ProviderID,
		&settings.RequireSSO, &settings.AllowLocalLogin,
		&settings.DomainWhitelist, &roleMappingsJSON,
		&settings.CreatedAt, &settings.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(roleMappingsJSON) > 0 {
		settings.RoleMappings = string(roleMappingsJSON)
	}

	return &settings, nil
}

func (r *enterpriseSettingsRepository) GetByOrganization(ctx context.Context, organizationID string) (*sso.EnterpriseSettings, error) {
	query := `
		SELECT id, organization_id, provider_id, require_sso, allow_local_login,
			   domain_whitelist, role_mappings, created_at, updated_at
		FROM enterprise_settings
		WHERE organization_id = $1`

	var settings sso.EnterpriseSettings
	var roleMappingsJSON []byte

	err := r.db.QueryRow(ctx, query, organizationID).Scan(
		&settings.ID, &settings.OrganizationID, &settings.ProviderID,
		&settings.RequireSSO, &settings.AllowLocalLogin,
		&settings.DomainWhitelist, &roleMappingsJSON,
		&settings.CreatedAt, &settings.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(roleMappingsJSON) > 0 {
		settings.RoleMappings = string(roleMappingsJSON)
	}

	return &settings, nil
}

func (r *enterpriseSettingsRepository) GetByProvider(ctx context.Context, providerID string) ([]*sso.EnterpriseSettings, error) {
	query := `
		SELECT id, organization_id, provider_id, require_sso, allow_local_login,
			   domain_whitelist, role_mappings, created_at, updated_at
		FROM enterprise_settings
		WHERE provider_id = $1
		ORDER BY organization_id`

	rows, err := r.db.Query(ctx, query, providerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanEnterpriseSettings(rows)
}

func (r *enterpriseSettingsRepository) Update(ctx context.Context, settings *sso.EnterpriseSettings) error {
	query := `
		UPDATE enterprise_settings
		SET require_sso = $2, allow_local_login = $3, domain_whitelist = $4,
			role_mappings = $5, updated_at = $6
		WHERE id = $1`

	roleMappingsJSON, _ := json.Marshal(settings.GetRoleMappings())

	_, err := r.db.Exec(ctx, query,
		settings.ID, settings.RequireSSO, settings.AllowLocalLogin,
		settings.DomainWhitelist, roleMappingsJSON, settings.UpdatedAt,
	)

	return err
}

func (r *enterpriseSettingsRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM enterprise_settings WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *enterpriseSettingsRepository) List(ctx context.Context, limit, offset int) ([]*sso.EnterpriseSettings, error) {
	query := `
		SELECT id, organization_id, provider_id, require_sso, allow_local_login,
			   domain_whitelist, role_mappings, created_at, updated_at
		FROM enterprise_settings
		ORDER BY organization_id
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanEnterpriseSettings(rows)
}

func (r *enterpriseSettingsRepository) Count(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM enterprise_settings`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}
