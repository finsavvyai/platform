package mocks

import (
	"context"
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/stretchr/testify/mock"
)

// MockUserRepository is a mock implementation of UserRepository
type MockUserRepository struct {
	mock.Mock
}

// Create creates a new user
func (m *MockUserRepository) Create(ctx context.Context, user *entities.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

// GetByID retrieves a user by ID
func (m *MockUserRepository) GetByID(ctx context.Context, id string) (*entities.User, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*entities.User), args.Error(1)
}

// GetByEmail retrieves a user by email address
func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*entities.User), args.Error(1)
}

// Update updates an existing user
func (m *MockUserRepository) Update(ctx context.Context, user *entities.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

// Delete deletes a user by ID
func (m *MockUserRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

// List retrieves users with pagination
func (m *MockUserRepository) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	args := m.Called(ctx, limit, offset)
	return args.Get(0).([]*entities.User), args.Error(1)
}

// Count returns the total number of users
func (m *MockUserRepository) Count(ctx context.Context) (int64, error) {
	args := m.Called(ctx)
	return args.Get(0).(int64), args.Error(1)
}

// GetByRole retrieves users by role with pagination
func (m *MockUserRepository) GetByRole(ctx context.Context, role string, limit, offset int) ([]*entities.User, error) {
	args := m.Called(ctx, role, limit, offset)
	return args.Get(0).([]*entities.User), args.Error(1)
}

// GetByPlan retrieves users by plan with pagination
func (m *MockUserRepository) GetByPlan(ctx context.Context, plan string, limit, offset int) ([]*entities.User, error) {
	args := m.Called(ctx, plan, limit, offset)
	return args.Get(0).([]*entities.User), args.Error(1)
}

// UpdateLastLogin updates the user's last login timestamp
func (m *MockUserRepository) UpdateLastLogin(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

// Exists checks if a user exists by ID
func (m *MockUserRepository) Exists(ctx context.Context, id string) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

// ExistsByEmail checks if a user exists by email
func (m *MockUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	args := m.Called(ctx, email)
	return args.Bool(0), args.Error(1)
}