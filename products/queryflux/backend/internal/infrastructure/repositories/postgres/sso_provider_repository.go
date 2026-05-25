package postgres

import (
	"context"
	"encoding/json"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ssoProviderRepository implements SSO provider repository using PostgreSQL
type ssoProviderRepository struct {
	db *pgxpool.Pool
}

// NewSSOProviderRepository creates a new PostgreSQL SSO provider repository
func NewSSOProviderRepository(db *pgxpool.Pool) sso.SSOProviderRepository {
	return &ssoProviderRepository{db: db}
}

func (r *ssoProviderRepository) Create(ctx context.Context, provider *sso.SSOProvider) error {
	query := `
		INSERT INTO sso_providers (
			id, name, type, entity_id, metadata_url, metadata_xml,
			client_id, client_secret, auth_url, token_url, user_info_url,
			scopes, enabled, auto_provision, default_role, default_plan,
			attribute_mapping, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)`

	attributeMappingJSON, _ := json.Marshal(provider.GetAttributeMapping())

	_, err := r.db.Exec(ctx, query,
		provider.ID, provider.Name, provider.Type, provider.EntityID,
		provider.MetadataURL, provider.MetadataXML, provider.ClientID,
		provider.ClientSecret, provider.AuthURL, provider.TokenURL,
		provider.UserInfoURL, provider.Scopes, provider.Enabled,
		provider.AutoProvision, provider.DefaultRole, provider.DefaultPlan,
		attributeMappingJSON, provider.CreatedAt, provider.UpdatedAt,
	)

	return err
}

func (r *ssoProviderRepository) GetByID(ctx context.Context, id string) (*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		WHERE id = $1`

	var provider sso.SSOProvider
	var attributeMappingJSON []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&provider.ID, &provider.Name, &provider.Type, &provider.EntityID,
		&provider.MetadataURL, &provider.MetadataXML, &provider.ClientID,
		&provider.ClientSecret, &provider.AuthURL, &provider.TokenURL,
		&provider.UserInfoURL, &provider.Scopes, &provider.Enabled,
		&provider.AutoProvision, &provider.DefaultRole, &provider.DefaultPlan,
		&attributeMappingJSON, &provider.CreatedAt, &provider.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(attributeMappingJSON) > 0 {
		var attributeMapping map[string]string
		if err := json.Unmarshal(attributeMappingJSON, &attributeMapping); err == nil {
			provider.AttributeMapping = string(attributeMappingJSON)
		}
	}

	return &provider, nil
}

func (r *ssoProviderRepository) GetByType(ctx context.Context, providerType sso.SSOProviderType) ([]*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		WHERE type = $1
		ORDER BY name`

	rows, err := r.db.Query(ctx, query, providerType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOProviders(rows)
}

func (r *ssoProviderRepository) GetEnabled(ctx context.Context) ([]*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		WHERE enabled = true
		ORDER BY name`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOProviders(rows)
}

func (r *ssoProviderRepository) GetByEntityID(ctx context.Context, entityID string) (*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		WHERE entity_id = $1`

	return scanSingleSSOProvider(r.db.QueryRow(ctx, query, entityID))
}

func (r *ssoProviderRepository) GetByClientID(ctx context.Context, clientID string) (*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		WHERE client_id = $1`

	return scanSingleSSOProvider(r.db.QueryRow(ctx, query, clientID))
}

func (r *ssoProviderRepository) Update(ctx context.Context, provider *sso.SSOProvider) error {
	query := `
		UPDATE sso_providers
		SET name = $2, entity_id = $3, metadata_url = $4, metadata_xml = $5,
			client_id = $6, client_secret = $7, auth_url = $8, token_url = $9,
			user_info_url = $10, scopes = $11, enabled = $12, auto_provision = $13,
			default_role = $14, default_plan = $15, attribute_mapping = $16,
			updated_at = $17
		WHERE id = $1`

	attributeMappingJSON, _ := json.Marshal(provider.GetAttributeMapping())

	_, err := r.db.Exec(ctx, query,
		provider.ID, provider.Name, provider.EntityID, provider.MetadataURL,
		provider.MetadataXML, provider.ClientID, provider.ClientSecret,
		provider.AuthURL, provider.TokenURL, provider.UserInfoURL,
		provider.Scopes, provider.Enabled, provider.AutoProvision,
		provider.DefaultRole, provider.DefaultPlan, attributeMappingJSON,
		provider.UpdatedAt,
	)

	return err
}

func (r *ssoProviderRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM sso_providers WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ssoProviderRepository) List(ctx context.Context, limit, offset int) ([]*sso.SSOProvider, error) {
	query := `
		SELECT id, name, type, entity_id, metadata_url, metadata_xml,
			   client_id, client_secret, auth_url, token_url, user_info_url,
			   scopes, enabled, auto_provision, default_role, default_plan,
			   attribute_mapping, created_at, updated_at
		FROM sso_providers
		ORDER BY name
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOProviders(rows)
}

func (r *ssoProviderRepository) Count(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM sso_providers`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}
