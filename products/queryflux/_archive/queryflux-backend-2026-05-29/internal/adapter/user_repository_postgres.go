package adapter

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain"
)

type UserRepositoryPostgres struct {
	pool *pgxpool.Pool
}

func NewUserRepositoryPostgres(pool *pgxpool.Pool) *UserRepositoryPostgres {
	return &UserRepositoryPostgres{pool: pool}
}

func (r *UserRepositoryPostgres) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	query := `SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1`

	err := r.pool.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.PasswordHash,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return &user, nil
}

func (r *UserRepositoryPostgres) Create(ctx context.Context, email, passwordHash string) (*domain.User, error) {
	id := uuid.New().String()
	now := time.Now()

	query := `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`
	_, err := r.pool.Exec(ctx, query, id, email, passwordHash, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &domain.User{
		ID:           id,
		Email:        email,
		PasswordHash: passwordHash,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (r *UserRepositoryPostgres) SaveRefreshToken(ctx context.Context, id, userID, token string, expiresAt interface{}) error {
	query := `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`
	_, err := r.pool.Exec(ctx, query, id, userID, token, expiresAt)
	return err
}

func (r *UserRepositoryPostgres) FindRefreshToken(ctx context.Context, token, userID string) (*domain.RefreshToken, error) {
	var t domain.RefreshToken
	query := `SELECT id, user_id, token, expires_at, revoked FROM refresh_tokens WHERE token = $1 AND user_id = $2`

	err := r.pool.QueryRow(ctx, query, token, userID).Scan(
		&t.ID, &t.UserID, &t.Token, &t.ExpiresAt, &t.Revoked,
	)
	if err != nil {
		return nil, fmt.Errorf("refresh token not found: %w", err)
	}

	return &t, nil
}

func (r *UserRepositoryPostgres) DeleteRefreshToken(ctx context.Context, tokenID string) error {
	query := `DELETE FROM refresh_tokens WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, tokenID)
	return err
}

func (r *UserRepositoryPostgres) RevokeRefreshToken(ctx context.Context, tokenID string) error {
	query := `UPDATE refresh_tokens SET revoked = true WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, tokenID)
	return err
}
