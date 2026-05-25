package services

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

// userService implements the UserService interface
type userService struct {
	userRepo repositories.UserRepository
}

// NewUserService creates a new user service
func NewUserService(userRepo repositories.UserRepository) UserService {
	return &userService{
		userRepo: userRepo,
	}
}

// Create creates a new user (internal use only - use AuthService.Register for user registration)
func (s *userService) Create(ctx context.Context, email, name string) (*entities.User, error) {
	return nil, fmt.Errorf("use AuthService.Register to create users with proper password handling")
}

// GetByID retrieves a user by ID
func (s *userService) GetByID(ctx context.Context, id string) (*entities.User, error) {
	user, err := s.userRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

// GetByEmail retrieves a user by email
func (s *userService) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

// Update updates user information
func (s *userService) Update(ctx context.Context, user *entities.User) error {
	if err := user.Validate(); err != nil {
		return fmt.Errorf("user validation failed: %w", err)
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// Delete deletes a user
func (s *userService) Delete(ctx context.Context, id string) error {
	// Check if user exists
	exists, err := s.userRepo.Exists(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check if user exists: %w", err)
	}
	if !exists {
		return fmt.Errorf("user with ID %s not found", id)
	}

	if err := s.userRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// UpdateProfile updates user profile
func (s *userService) UpdateProfile(ctx context.Context, userID, name string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if err := user.UpdateProfile(name); err != nil {
		return fmt.Errorf("failed to update profile: %w", err)
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to save user: %w", err)
	}

	return nil
}

// SetRole sets user role
func (s *userService) SetRole(ctx context.Context, userID, role string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if err := user.SetRole(role); err != nil {
		return fmt.Errorf("failed to set role: %w", err)
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to save user: %w", err)
	}

	return nil
}

// SetPlan sets user plan
func (s *userService) SetPlan(ctx context.Context, userID, plan string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if err := user.SetPlan(plan); err != nil {
		return fmt.Errorf("failed to set plan: %w", err)
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to save user: %w", err)
	}

	return nil
}

// List lists users with pagination
func (s *userService) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	users, err := s.userRepo.List(ctx, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	return users, nil
}

// Count returns total user count
func (s *userService) Count(ctx context.Context) (int64, error) {
	count, err := s.userRepo.Count(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}

	return count, nil
}