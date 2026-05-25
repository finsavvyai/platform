package sdln

import (
	"context"
	"fmt"
)

// UserService handles user-related operations
type UserService struct {
	*BaseService
}

// NewUserService creates a new user service
func NewUserService(client *Client) *UserService {
	return &UserService{
		BaseService: NewBaseService(client, "users", "api/v1/users"),
	}
}

// CreateUserRequest represents a request to create a user
type CreateUserRequest struct {
	Email       string            `json:"email"`
	FirstName   string            `json:"first_name"`
	LastName    string            `json:"last_name"`
	Password    string            `json:"password,omitempty"`
	Role        string            `json:"role"`
	TenantID    string            `json:"tenant_id"`
	IsActive    bool              `json:"is_active"`
	Preferences map[string]string `json:"preferences,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	Invited     bool              `json:"invited,omitempty"`
}

// UpdateUserRequest represents a request to update a user
type UpdateUserRequest struct {
	FirstName   *string           `json:"first_name,omitempty"`
	LastName    *string           `json:"last_name,omitempty"`
	Role        *string           `json:"role,omitempty"`
	IsActive    *bool             `json:"is_active,omitempty"`
	Preferences map[string]string `json:"preferences,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// User represents a user
type User struct {
	ID          string            `json:"id"`
	Email       string            `json:"email"`
	FirstName   string            `json:"first_name"`
	LastName    string            `json:"last_name"`
	Role        string            `json:"role"`
	TenantID    string            `json:"tenant_id"`
	IsActive    bool              `json:"is_active"`
	Preferences map[string]string `json:"preferences"`
	Metadata    map[string]string `json:"metadata"`
	LastLoginAt *Timestamp        `json:"last_login_at"`
	CreatedAt   Timestamp         `json:"created_at"`
	UpdatedAt   Timestamp         `json:"updated_at"`
}

// Create creates a new user
func (s *UserService) Create(ctx context.Context, req *CreateUserRequest) (*User, error) {
	var user User
	err := s.doPost(ctx, "", req, &user)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &user, nil
}

// Get retrieves a user by ID
func (s *UserService) Get(ctx context.Context, userID string) (*User, error) {
	var user User
	err := s.doGet(ctx, fmt.Sprintf("/%s", userID), &user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return &user, nil
}

// GetByEmail retrieves a user by email
func (s *UserService) GetByEmail(ctx context.Context, email string) (*User, error) {
	var user User
	err := s.doGet(ctx, fmt.Sprintf("/by-email/%s", email), &user)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return &user, nil
}

// List retrieves a list of users
func (s *UserService) List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[User], error) {
	path := ""
	if opts != nil {
		path = s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[User]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	return &response, nil
}

// Update updates a user
func (s *UserService) Update(ctx context.Context, userID string, req *UpdateUserRequest) (*User, error) {
	var user User
	err := s.doPatch(ctx, fmt.Sprintf("/%s", userID), req, &user)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}
	return &user, nil
}

// Delete deletes a user
func (s *UserService) Delete(ctx context.Context, userID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/%s", userID))
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

// BulkCreate creates multiple users
func (s *UserService) BulkCreate(ctx context.Context, users []*CreateUserRequest) (*BulkResult[User], error) {
	req := map[string]interface{}{
		"users": users,
	}

	var result BulkResult[User]
	err := s.doPost(ctx, "/bulk", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to bulk create users: %w", err)
	}
	return &result, nil
}

// BulkUpdate updates multiple users
func (s *UserService) BulkUpdate(ctx context.Context, updates map[string]*UpdateUserRequest) (*BulkResult[User], error) {
	req := map[string]interface{}{
		"updates": updates,
	}

	var result BulkResult[User]
	err := s.doPut(ctx, "/bulk", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to bulk update users: %w", err)
	}
	return &result, nil
}

// BulkDelete deletes multiple users
func (s *UserService) BulkDelete(ctx context.Context, userIDs []string) (*BulkDeleteResult, error) {
	req := map[string]interface{}{
		"user_ids": userIDs,
	}

	var result BulkDeleteResult
	err := s.doPost(ctx, "/bulk/delete", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to bulk delete users: %w", err)
	}
	return &result, nil
}

// ChangePassword changes a user's password
func (s *UserService) ChangePassword(ctx context.Context, userID string, currentPassword, newPassword string) error {
	req := map[string]string{
		"current_password": currentPassword,
		"new_password":     newPassword,
	}

	err := s.doPost(ctx, fmt.Sprintf("/%s/password", userID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to change password: %w", err)
	}
	return nil
}

// ResetPassword resets a user's password
func (s *UserService) ResetPassword(ctx context.Context, userID string) (*ResetPasswordResponse, error) {
	var response ResetPasswordResponse
	err := s.doPost(ctx, fmt.Sprintf("/%s/reset-password", userID), nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to reset password: %w", err)
	}
	return &response, nil
}

// Suspend suspends a user
func (s *UserService) Suspend(ctx context.Context, userID string, reason string) error {
	req := map[string]string{
		"reason": reason,
	}

	err := s.doPost(ctx, fmt.Sprintf("/%s/suspend", userID), req, nil)
	if err != nil {
		return fmt.Errorf("failed to suspend user: %w", err)
	}
	return nil
}

// Unsuspend unsuspends a user
func (s *UserService) Unsuspend(ctx context.Context, userID string) error {
	err := s.doPost(ctx, fmt.Sprintf("/%s/unsuspend", userID), nil, nil)
	if err != nil {
		return fmt.Errorf("failed to unsuspend user: %w", err)
	}
	return nil
}

// GetActivity returns user activity
func (s *UserService) GetActivity(ctx context.Context, userID string, opts *ListOptions) (*PaginatedResponse[UserServiceActivity], error) {
	path := fmt.Sprintf("/%s/activity", userID)
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[UserServiceActivity]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get user activity: %w", err)
	}
	return &response, nil
}

// UserServiceActivity represents a user activity event
type UserServiceActivity struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Action    string    `json:"action"`
	Resource  string    `json:"resource"`
	Details   string    `json:"details"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt Timestamp `json:"created_at"`
}

// ResetPasswordResponse represents a password reset response
type ResetPasswordResponse struct {
	TemporaryPassword string    `json:"temporary_password"`
	ExpiresAt         Timestamp `json:"expires_at"`
}
