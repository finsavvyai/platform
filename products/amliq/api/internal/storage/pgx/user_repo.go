package pgx

import (
	"context"
	"database/sql"

	"github.com/aegis-aml/aegis/internal/domain"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user domain.User) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO users (id, tenant_id, email, password, role,
		                   provider, provider_id, name, avatar_url, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, user.ID, user.TenantID, user.Email, user.Password,
		user.Role, user.Provider, user.ProviderID,
		user.Name, user.AvatarURL, user.CreatedAt)
	return err
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return r.scanOne(r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, email, password, role, provider,
		        provider_id, name, avatar_url, created_at
		 FROM users WHERE email = $1`, email))
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	return r.scanOne(r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, email, password, role, provider,
		        provider_id, name, avatar_url, created_at
		 FROM users WHERE id = $1`, id))
}

func (r *UserRepository) GetByProvider(ctx context.Context, provider, providerID string) (*domain.User, error) {
	return r.scanOne(r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, email, password, role, provider,
		        provider_id, name, avatar_url, created_at
		 FROM users WHERE provider = $1 AND provider_id = $2`,
		provider, providerID))
}

func (r *UserRepository) scanOne(row *sql.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(&u.ID, &u.TenantID, &u.Email, &u.Password,
		&u.Role, &u.Provider, &u.ProviderID, &u.Name,
		&u.AvatarURL, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
