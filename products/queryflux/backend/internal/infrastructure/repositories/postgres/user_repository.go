package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// PgxIface is an interface that both *pgxpool.Pool and pgxmock implement
type PgxIface interface {
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Close()
}

// userRepository implements the UserRepository interface for PostgreSQL
type userRepository struct {
	db PgxIface
}

// NewUserRepository creates a new PostgreSQL user repository
func NewUserRepository(db PgxIface) repositories.UserRepository {
	return &userRepository{db: db}
}

// Create creates a new user
func (r *userRepository) Create(ctx context.Context, user *entities.User) error {
	query := `
		INSERT INTO users (id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
		user.Role,
		user.Plan,
		user.LastLoginAt,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// GetByID retrieves a user by ID
func (r *userRepository) GetByID(ctx context.Context, id string) (*entities.User, error) {
	query := `
		SELECT id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var user entities.User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Role,
		&user.Plan,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetByEmail retrieves a user by email address
func (r *userRepository) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	query := `
		SELECT id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user entities.User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.PasswordHash,
		&user.Role,
		&user.Plan,
		&user.LastLoginAt,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// Update updates an existing user
func (r *userRepository) Update(ctx context.Context, user *entities.User) error {
	query := `
		UPDATE users
		SET email = $2, name = $3, password_hash = $4, role = $5, plan = $6, 
		    last_login_at = $7, updated_at = $8
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query,
		user.ID,
		user.Email,
		user.Name,
		user.PasswordHash,
		user.Role,
		user.Plan,
		user.LastLoginAt,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

// Delete deletes a user by ID
func (r *userRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM users WHERE id = $1`

	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

// List retrieves users with pagination
func (r *userRepository) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	query := `
		SELECT id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []*entities.User
	for rows.Next() {
		var user entities.User
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.PasswordHash,
			&user.Role,
			&user.Plan,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}

	return users, nil
}

// Count returns the total number of users
func (r *userRepository) Count(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM users`

	var count int64
	err := r.db.QueryRow(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}

	return count, nil
}

// GetByRole retrieves users by role with pagination
func (r *userRepository) GetByRole(ctx context.Context, role string, limit, offset int) ([]*entities.User, error) {
	query := `
		SELECT id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at
		FROM users
		WHERE role = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, role, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get users by role: %w", err)
	}
	defer rows.Close()

	var users []*entities.User
	for rows.Next() {
		var user entities.User
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.PasswordHash,
			&user.Role,
			&user.Plan,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}

	return users, nil
}

// GetByPlan retrieves users by plan with pagination
func (r *userRepository) GetByPlan(ctx context.Context, plan string, limit, offset int) ([]*entities.User, error) {
	query := `
		SELECT id, email, name, password_hash, role, plan, last_login_at, created_at, updated_at
		FROM users
		WHERE plan = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, plan, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get users by plan: %w", err)
	}
	defer rows.Close()

	var users []*entities.User
	for rows.Next() {
		var user entities.User
		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.PasswordHash,
			&user.Role,
			&user.Plan,
			&user.LastLoginAt,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, &user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}

	return users, nil
}

// UpdateLastLogin updates the user's last login timestamp
func (r *userRepository) UpdateLastLogin(ctx context.Context, userID string) error {
	query := `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`

	result, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to update last login: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

// Exists checks if a user exists by ID
func (r *userRepository) Exists(ctx context.Context, id string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`

	var exists bool
	err := r.db.QueryRow(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}

	return exists, nil
}

// ExistsByEmail checks if a user exists by email
func (r *userRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`

	var exists bool
	err := r.db.QueryRow(ctx, query, email).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence by email: %w", err)
	}

	return exists, nil
}
