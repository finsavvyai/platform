package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ssoIdentityRepository implements SSO identity repository using PostgreSQL
type ssoIdentityRepository struct {
	db *pgxpool.Pool
}

// NewSSOIdentityRepository creates a new PostgreSQL SSO identity repository
func NewSSOIdentityRepository(db *pgxpool.Pool) sso.SSOIdentityRepository {
	return &ssoIdentityRepository{db: db}
}

func (r *ssoIdentityRepository) Create(ctx context.Context, identity *sso.SSOIdentity) error {
	query := `INSERT INTO sso_identities (id, user_id, provider_id, external_id, email, name,
		first_name, last_name, attributes, last_authenticated, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	attributesJSON, _ := json.Marshal(identity.Attributes)
	_, err := r.db.Exec(ctx, query,
		identity.ID, identity.UserID, identity.ProviderID, identity.ExternalID,
		identity.Email, identity.Name, identity.FirstName, identity.LastName,
		attributesJSON, identity.LastAuthenticated, identity.CreatedAt, identity.UpdatedAt)
	return err
}

func (r *ssoIdentityRepository) GetByID(ctx context.Context, id string) (*sso.SSOIdentity, error) {
	query := `
		SELECT id, user_id, provider_id, external_id, email, name,
			   first_name, last_name, attributes, last_authenticated,
			   created_at, updated_at
		FROM sso_identities
		WHERE id = $1`

	var identity sso.SSOIdentity
	var attributesJSON []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&identity.ID, &identity.UserID, &identity.ProviderID,
		&identity.ExternalID, &identity.Email, &identity.Name,
		&identity.FirstName, &identity.LastName, &attributesJSON,
		&identity.LastAuthenticated, &identity.CreatedAt, &identity.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(attributesJSON) > 0 {
		json.Unmarshal(attributesJSON, &identity.Attributes)
	}

	return &identity, nil
}

func (r *ssoIdentityRepository) GetByProviderAndExternalID(ctx context.Context, providerID, externalID string) (*sso.SSOIdentity, error) {
	query := `
		SELECT id, user_id, provider_id, external_id, email, name,
			   first_name, last_name, attributes, last_authenticated,
			   created_at, updated_at
		FROM sso_identities
		WHERE provider_id = $1 AND external_id = $2`

	var identity sso.SSOIdentity
	var attributesJSON []byte

	err := r.db.QueryRow(ctx, query, providerID, externalID).Scan(
		&identity.ID, &identity.UserID, &identity.ProviderID,
		&identity.ExternalID, &identity.Email, &identity.Name,
		&identity.FirstName, &identity.LastName, &attributesJSON,
		&identity.LastAuthenticated, &identity.CreatedAt, &identity.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(attributesJSON) > 0 {
		json.Unmarshal(attributesJSON, &identity.Attributes)
	}

	return &identity, nil
}

func (r *ssoIdentityRepository) GetByUserID(ctx context.Context, userID string) ([]*sso.SSOIdentity, error) {
	query := `
		SELECT id, user_id, provider_id, external_id, email, name,
			   first_name, last_name, attributes, last_authenticated,
			   created_at, updated_at
		FROM sso_identities
		WHERE user_id = $1
		ORDER BY last_authenticated DESC NULLS LAST`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOIdentities(rows)
}

func (r *ssoIdentityRepository) GetByEmail(ctx context.Context, email string) ([]*sso.SSOIdentity, error) {
	query := `
		SELECT id, user_id, provider_id, external_id, email, name,
			   first_name, last_name, attributes, last_authenticated,
			   created_at, updated_at
		FROM sso_identities
		WHERE email = $1
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOIdentities(rows)
}

func (r *ssoIdentityRepository) Update(ctx context.Context, identity *sso.SSOIdentity) error {
	query := `
		UPDATE sso_identities
		SET user_id = $2, email = $3, name = $4, first_name = $5,
			last_name = $6, attributes = $7, last_authenticated = $8,
			updated_at = $9
		WHERE id = $1`

	attributesJSON, _ := json.Marshal(identity.Attributes)

	_, err := r.db.Exec(ctx, query,
		identity.ID, identity.UserID, identity.Email, identity.Name,
		identity.FirstName, identity.LastName, attributesJSON,
		identity.LastAuthenticated, identity.UpdatedAt,
	)

	return err
}

func (r *ssoIdentityRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM sso_identities WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ssoIdentityRepository) List(ctx context.Context, limit, offset int) ([]*sso.SSOIdentity, error) {
	query := `
		SELECT id, user_id, provider_id, external_id, email, name,
			   first_name, last_name, attributes, last_authenticated,
			   created_at, updated_at
		FROM sso_identities
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOIdentities(rows)
}

func (r *ssoIdentityRepository) Count(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM sso_identities`
	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	return count, err
}

func (r *ssoIdentityRepository) LinkToUser(ctx context.Context, identityID, userID string) error {
	query := `
		UPDATE sso_identities
		SET user_id = $2, updated_at = $3
		WHERE id = $1`

	_, err := r.db.Exec(ctx, query, identityID, userID, time.Now())
	return err
}

func (r *ssoIdentityRepository) UnlinkFromUser(ctx context.Context, identityID string) error {
	query := `
		UPDATE sso_identities
		SET user_id = NULL, updated_at = $2
		WHERE id = $1`

	_, err := r.db.Exec(ctx, query, identityID, time.Now())
	return err
}
