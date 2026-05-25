package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/queryflux/backend/internal/domain/sso"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ssoSessionRepository implements SSO session repository using PostgreSQL
type ssoSessionRepository struct {
	db *pgxpool.Pool
}

// NewSSOSessionRepository creates a new PostgreSQL SSO session repository
func NewSSOSessionRepository(db *pgxpool.Pool) sso.SSOSessionRepository {
	return &ssoSessionRepository{db: db}
}

func (r *ssoSessionRepository) Create(ctx context.Context, session *sso.SSOSession) error {
	query := `
		INSERT INTO sso_sessions (
			id, identity_id, request_id, state, nonce, redirect_url,
			metadata, expires_at, is_active, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		)`

	metadataJSON, _ := json.Marshal(session.Metadata)

	_, err := r.db.Exec(ctx, query,
		session.ID, session.IdentityID, session.RequestID, session.State,
		session.Nonce, session.RedirectURL, metadataJSON, session.ExpiresAt,
		session.IsActive, session.CreatedAt, session.UpdatedAt,
	)

	return err
}

func (r *ssoSessionRepository) GetByID(ctx context.Context, id string) (*sso.SSOSession, error) {
	query := `
		SELECT id, identity_id, request_id, state, nonce, redirect_url,
			   metadata, expires_at, is_active, created_at, updated_at
		FROM sso_sessions
		WHERE id = $1`

	var session sso.SSOSession
	var metadataJSON []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&session.ID, &session.IdentityID, &session.RequestID, &session.State,
		&session.Nonce, &session.RedirectURL, &metadataJSON,
		&session.ExpiresAt, &session.IsActive, &session.CreatedAt, &session.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &session.Metadata)
	}

	return &session, nil
}

func (r *ssoSessionRepository) GetByRequestID(ctx context.Context, requestID string) (*sso.SSOSession, error) {
	query := `
		SELECT id, identity_id, request_id, state, nonce, redirect_url,
			   metadata, expires_at, is_active, created_at, updated_at
		FROM sso_sessions
		WHERE request_id = $1`

	var session sso.SSOSession
	var metadataJSON []byte

	err := r.db.QueryRow(ctx, query, requestID).Scan(
		&session.ID, &session.IdentityID, &session.RequestID, &session.State,
		&session.Nonce, &session.RedirectURL, &metadataJSON,
		&session.ExpiresAt, &session.IsActive, &session.CreatedAt, &session.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &session.Metadata)
	}

	return &session, nil
}

func (r *ssoSessionRepository) GetByState(ctx context.Context, state string) (*sso.SSOSession, error) {
	query := `
		SELECT id, identity_id, request_id, state, nonce, redirect_url,
			   metadata, expires_at, is_active, created_at, updated_at
		FROM sso_sessions
		WHERE state = $1`

	var session sso.SSOSession
	var metadataJSON []byte

	err := r.db.QueryRow(ctx, query, state).Scan(
		&session.ID, &session.IdentityID, &session.RequestID, &session.State,
		&session.Nonce, &session.RedirectURL, &metadataJSON,
		&session.ExpiresAt, &session.IsActive, &session.CreatedAt, &session.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		json.Unmarshal(metadataJSON, &session.Metadata)
	}

	return &session, nil
}

func (r *ssoSessionRepository) GetActiveByIdentity(ctx context.Context, identityID string) ([]*sso.SSOSession, error) {
	query := `
		SELECT id, identity_id, request_id, state, nonce, redirect_url,
			   metadata, expires_at, is_active, created_at, updated_at
		FROM sso_sessions
		WHERE identity_id = $1 AND is_active = true AND expires_at > NOW()
		ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, identityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanSSOSessions(rows)
}

func (r *ssoSessionRepository) Update(ctx context.Context, session *sso.SSOSession) error {
	query := `
		UPDATE sso_sessions
		SET identity_id = $2, request_id = $3, state = $4, nonce = $5,
			redirect_url = $6, metadata = $7, expires_at = $8,
			is_active = $9, updated_at = $10
		WHERE id = $1`

	metadataJSON, _ := json.Marshal(session.Metadata)

	_, err := r.db.Exec(ctx, query,
		session.ID, session.IdentityID, session.RequestID, session.State,
		session.Nonce, session.RedirectURL, metadataJSON, session.ExpiresAt,
		session.IsActive, session.UpdatedAt,
	)

	return err
}

func (r *ssoSessionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM sso_sessions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ssoSessionRepository) DeleteExpired(ctx context.Context) error {
	query := `DELETE FROM sso_sessions WHERE expires_at < NOW()`
	_, err := r.db.Exec(ctx, query)
	return err
}

func (r *ssoSessionRepository) DeactivateByIdentity(ctx context.Context, identityID string) error {
	query := `
		UPDATE sso_sessions
		SET is_active = false, updated_at = $2
		WHERE identity_id = $1`

	_, err := r.db.Exec(ctx, query, identityID, time.Now())
	return err
}

func (r *ssoSessionRepository) DeactivateByUser(ctx context.Context, userID string) error {
	query := `
		UPDATE sso_sessions
		SET is_active = false, updated_at = $2
		WHERE identity_id IN (
			SELECT id FROM sso_identities WHERE user_id = $1
		)`

	_, err := r.db.Exec(ctx, query, userID, time.Now())
	return err
}
