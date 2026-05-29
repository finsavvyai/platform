package adapter

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain"
)

type ConnectionRepositoryPostgres struct {
	pool *pgxpool.Pool
}

func NewConnectionRepositoryPostgres(pool *pgxpool.Pool) *ConnectionRepositoryPostgres {
	return &ConnectionRepositoryPostgres{pool: pool}
}

func (r *ConnectionRepositoryPostgres) Create(ctx context.Context, conn *domain.Connection) error {
	query := `
		INSERT INTO connections (id, user_id, name, type, host, port, database_name,
		  username, encrypted_password, ssl_mode, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.pool.Exec(ctx, query,
		conn.ID, conn.UserID, conn.Name, conn.Type, conn.Host, conn.Port,
		conn.Database, conn.Username, conn.EncryptedPassword, conn.SSLMode,
		conn.CreatedAt, conn.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create connection: %w", err)
	}

	return nil
}

func (r *ConnectionRepositoryPostgres) FindByID(ctx context.Context, id string) (*domain.Connection, error) {
	var conn domain.Connection
	query := `
		SELECT id, user_id, name, type, host, port, database_name,
		  username, encrypted_password, ssl_mode, created_at, updated_at
		FROM connections WHERE id = $1
	`

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&conn.ID, &conn.UserID, &conn.Name, &conn.Type,
		&conn.Host, &conn.Port, &conn.Database, &conn.Username,
		&conn.EncryptedPassword, &conn.SSLMode,
		&conn.CreatedAt, &conn.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("connection not found: %w", err)
	}

	return &conn, nil
}

func (r *ConnectionRepositoryPostgres) FindByUserID(ctx context.Context, userID string) ([]domain.Connection, error) {
	query := `
		SELECT id, user_id, name, type, host, port, database_name,
		  username, encrypted_password, ssl_mode, created_at, updated_at
		FROM connections WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query connections: %w", err)
	}
	defer rows.Close()

	var connections []domain.Connection
	for rows.Next() {
		var conn domain.Connection
		if err := rows.Scan(
			&conn.ID, &conn.UserID, &conn.Name, &conn.Type,
			&conn.Host, &conn.Port, &conn.Database, &conn.Username,
			&conn.EncryptedPassword, &conn.SSLMode,
			&conn.CreatedAt, &conn.UpdatedAt,
		); err != nil {
			return nil, err
		}
		connections = append(connections, conn)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return connections, nil
}

func (r *ConnectionRepositoryPostgres) Update(ctx context.Context, conn *domain.Connection) error {
	query := `
		UPDATE connections SET name = $1, host = $2, port = $3, database_name = $4,
		  username = $5, encrypted_password = $6, ssl_mode = $7, updated_at = $8
		WHERE id = $9
	`

	_, err := r.pool.Exec(ctx, query,
		conn.Name, conn.Host, conn.Port, conn.Database,
		conn.Username, conn.EncryptedPassword, conn.SSLMode,
		conn.UpdatedAt, conn.ID,
	)
	return err
}

func (r *ConnectionRepositoryPostgres) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM connections WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
