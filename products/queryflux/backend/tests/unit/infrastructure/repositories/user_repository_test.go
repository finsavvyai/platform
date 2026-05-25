package repositories

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/pashagolub/pgxmock/v3"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserRepository_Create(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("successful creation", func(t *testing.T) {
		user := &entities.User{
			ID:           "user-123",
			Email:        "test@example.com",
			Name:         "Test User",
			PasswordHash: "hashed_password",
			Role:         "user",
			Plan:         "free",
			LastLoginAt:  nil,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		mock.ExpectExec("INSERT INTO users").
			WithArgs(
				user.ID,
				user.Email,
				user.Name,
				user.PasswordHash,
				user.Role,
				user.Plan,
				user.LastLoginAt,
				pgxmock.AnyArg(), // created_at
				pgxmock.AnyArg(), // updated_at
			).
			WillReturnResult(pgxmock.NewResult("INSERT", 1))

		err := repo.Create(context.Background(), user)

		assert.NoError(t, err)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("duplicate email error", func(t *testing.T) {
		user := &entities.User{
			ID:           "user-456",
			Email:        "duplicate@example.com",
			Name:         "Duplicate User",
			PasswordHash: "hashed_password",
			Role:         "user",
			Plan:         "free",
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		mock.ExpectExec("INSERT INTO users").
			WithArgs(
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
			).
			WillReturnError(assert.AnError)

		err := repo.Create(context.Background(), user)

		assert.Error(t, err)
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_GetByID(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("user found", func(t *testing.T) {
		userID := "user-123"
		now := time.Now()

		rows := pgxmock.NewRows([]string{
			"id", "email", "name", "password_hash", "role", "plan",
			"last_login_at", "created_at", "updated_at",
		}).AddRow(
			userID, "test@example.com", "Test User", "hashed_password",
			"user", "free", nil, now, now,
		)

		mock.ExpectQuery("SELECT (.+) FROM users WHERE id").
			WithArgs(userID).
			WillReturnRows(rows)

		user, err := repo.GetByID(context.Background(), userID)

		assert.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, userID, user.ID)
		assert.Equal(t, "test@example.com", user.Email)
		assert.Equal(t, "Test User", user.Name)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("user not found", func(t *testing.T) {
		userID := "nonexistent-user"

		mock.ExpectQuery("SELECT (.+) FROM users WHERE id").
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		user, err := repo.GetByID(context.Background(), userID)

		assert.Error(t, err)
		assert.Nil(t, user)
		assert.Contains(t, err.Error(), "user not found")
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_GetByEmail(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("user found by email", func(t *testing.T) {
		email := "test@example.com"
		now := time.Now()

		rows := pgxmock.NewRows([]string{
			"id", "email", "name", "password_hash", "role", "plan",
			"last_login_at", "created_at", "updated_at",
		}).AddRow(
			"user-123", email, "Test User", "hashed_password",
			"user", "free", nil, now, now,
		)

		mock.ExpectQuery("SELECT (.+) FROM users WHERE email").
			WithArgs(email).
			WillReturnRows(rows)

		user, err := repo.GetByEmail(context.Background(), email)

		assert.NoError(t, err)
		assert.NotNil(t, user)
		assert.Equal(t, email, user.Email)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("user not found by email", func(t *testing.T) {
		email := "nonexistent@example.com"

		mock.ExpectQuery("SELECT (.+) FROM users WHERE email").
			WithArgs(email).
			WillReturnError(sql.ErrNoRows)

		user, err := repo.GetByEmail(context.Background(), email)

		assert.Error(t, err)
		assert.Nil(t, user)
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_Update(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("successful update", func(t *testing.T) {
		user := &entities.User{
			ID:           "user-123",
			Email:        "updated@example.com",
			Name:         "Updated User",
			PasswordHash: "new_hashed_password",
			Role:         "admin",
			Plan:         "pro",
			LastLoginAt:  nil,
			UpdatedAt:    time.Now(),
		}

		mock.ExpectExec("UPDATE users").
			WithArgs(
				user.ID,
				user.Email,
				user.Name,
				user.PasswordHash,
				user.Role,
				user.Plan,
				user.LastLoginAt,
				pgxmock.AnyArg(), // updated_at
			).
			WillReturnResult(pgxmock.NewResult("UPDATE", 1))

		err := repo.Update(context.Background(), user)

		assert.NoError(t, err)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("user not found for update", func(t *testing.T) {
		user := &entities.User{
			ID:        "nonexistent-user",
			Email:     "test@example.com",
			Name:      "Test",
			UpdatedAt: time.Now(),
		}

		mock.ExpectExec("UPDATE users").
			WithArgs(
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
				pgxmock.AnyArg(),
			).
			WillReturnResult(pgxmock.NewResult("UPDATE", 0))

		err := repo.Update(context.Background(), user)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "user not found")
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_Delete(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("successful deletion", func(t *testing.T) {
		userID := "user-123"

		mock.ExpectExec("DELETE FROM users WHERE id").
			WithArgs(userID).
			WillReturnResult(pgxmock.NewResult("DELETE", 1))

		err := repo.Delete(context.Background(), userID)

		assert.NoError(t, err)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("user not found for deletion", func(t *testing.T) {
		userID := "nonexistent-user"

		mock.ExpectExec("DELETE FROM users WHERE id").
			WithArgs(userID).
			WillReturnResult(pgxmock.NewResult("DELETE", 0))

		err := repo.Delete(context.Background(), userID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "user not found")
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_List(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("list users with pagination", func(t *testing.T) {
		now := time.Now()
		rows := pgxmock.NewRows([]string{
			"id", "email", "name", "password_hash", "role", "plan",
			"last_login_at", "created_at", "updated_at",
		}).
			AddRow("user-1", "user1@example.com", "User 1", "hash1", "user", "free", nil, now, now).
			AddRow("user-2", "user2@example.com", "User 2", "hash2", "admin", "pro", nil, now, now)

		mock.ExpectQuery("SELECT (.+) FROM users ORDER BY created_at DESC LIMIT").
			WithArgs(10, 0).
			WillReturnRows(rows)

		users, err := repo.List(context.Background(), 10, 0)

		assert.NoError(t, err)
		assert.Len(t, users, 2)
		assert.Equal(t, "user-1", users[0].ID)
		assert.Equal(t, "user-2", users[1].ID)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("empty list", func(t *testing.T) {
		rows := pgxmock.NewRows([]string{
			"id", "email", "name", "password_hash", "role", "plan",
			"last_login_at", "created_at", "updated_at",
		})

		mock.ExpectQuery("SELECT (.+) FROM users ORDER BY created_at DESC LIMIT").
			WithArgs(10, 0).
			WillReturnRows(rows)

		users, err := repo.List(context.Background(), 10, 0)

		assert.NoError(t, err)
		assert.Empty(t, users)
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_Count(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("count users", func(t *testing.T) {
		rows := pgxmock.NewRows([]string{"count"}).AddRow(int64(42))

		mock.ExpectQuery("SELECT COUNT").
			WillReturnRows(rows)

		count, err := repo.Count(context.Background())

		assert.NoError(t, err)
		assert.Equal(t, int64(42), count)
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestUserRepository_ExistsByEmail(t *testing.T) {
	mock, err := pgxmock.NewPool()
	require.NoError(t, err)
	defer mock.Close()

	repo := postgres.NewUserRepository(mock)

	t.Run("email exists", func(t *testing.T) {
		email := "existing@example.com"
		rows := pgxmock.NewRows([]string{"exists"}).AddRow(true)

		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(email).
			WillReturnRows(rows)

		exists, err := repo.ExistsByEmail(context.Background(), email)

		assert.NoError(t, err)
		assert.True(t, exists)
		assert.NoError(t, mock.ExpectationsWereMet())
	})

	t.Run("email does not exist", func(t *testing.T) {
		email := "nonexistent@example.com"
		rows := pgxmock.NewRows([]string{"exists"}).AddRow(false)

		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(email).
			WillReturnRows(rows)

		exists, err := repo.ExistsByEmail(context.Background(), email)

		assert.NoError(t, err)
		assert.False(t, exists)
		assert.NoError(t, mock.ExpectationsWereMet())
	})
}
