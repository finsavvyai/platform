package services

import (
	"context"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// UserService defines the interface for user business logic
type UserService interface {
	Create(ctx context.Context, email, name string) (*entities.User, error)
	GetByID(ctx context.Context, id string) (*entities.User, error)
	GetByEmail(ctx context.Context, email string) (*entities.User, error)
	Update(ctx context.Context, user *entities.User) error
	Delete(ctx context.Context, id string) error
	UpdateProfile(ctx context.Context, userID, name string) error
	SetRole(ctx context.Context, userID, role string) error
	SetPlan(ctx context.Context, userID, plan string) error
	List(ctx context.Context, limit, offset int) ([]*entities.User, error)
	Count(ctx context.Context) (int64, error)
}

// ConnectionService defines the interface for database connection business logic
type ConnectionService interface {
	Create(ctx context.Context, userID, name, dbType, host string, port int, database, username, password string) (*entities.Connection, error)
	GetByID(ctx context.Context, id string) (*entities.Connection, error)
	GetByUserID(ctx context.Context, userID string, limit, offset int) ([]*entities.Connection, error)
	Update(ctx context.Context, connection *entities.Connection) error
	Delete(ctx context.Context, id string) error
	Test(ctx context.Context, connection *entities.Connection) error
	GetActiveConnections(ctx context.Context, userID string) ([]*entities.Connection, error)
	UpdateStatus(ctx context.Context, connectionID, status string) error
	MarkAsUsed(ctx context.Context, connectionID string) error
}

// QueryService defines the interface for query execution business logic
type QueryService interface {
	Execute(ctx context.Context, userID, connectionID, sql string) (*entities.Query, error)
	GetByID(ctx context.Context, id string) (*entities.Query, error)
	GetHistory(ctx context.Context, connectionID string, limit, offset int) ([]*entities.Query, error)
	GetUserHistory(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error)
	Save(ctx context.Context, userID, connectionID, name, sql string) (*entities.Query, error)
	GetSavedQueries(ctx context.Context, userID string, limit, offset int) ([]*entities.Query, error)
	Delete(ctx context.Context, id string) error
	Cancel(ctx context.Context, queryID string) error
	GetRunningQueries(ctx context.Context, userID string) ([]*entities.Query, error)
	GetExecutionStats(ctx context.Context, userID string, days int) (*repositories.QueryExecutionStats, error)
	Search(ctx context.Context, userID, searchTerm string, limit, offset int) ([]*entities.Query, error)
}

// AuthService defines the interface for authentication business logic
type AuthService interface {
	Register(ctx context.Context, email, name, password string) (*entities.User, string, error)
	Login(ctx context.Context, email, password string) (*entities.User, string, error)
	Logout(ctx context.Context, token string) error
	RefreshToken(ctx context.Context, token string) (string, error)
	ValidateToken(ctx context.Context, token string) (*entities.User, error)
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error
	ResetPassword(ctx context.Context, email string) error
	ConfirmPasswordReset(ctx context.Context, token, newPassword string) error
}
