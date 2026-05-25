package entities

import (
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	ID           string     `json:"id" db:"id"`
	Email        string     `json:"email" db:"email"`
	Name         string     `json:"name" db:"name"`
	PasswordHash string     `json:"-" db:"password_hash"` // Never include in JSON responses
	Role         string     `json:"role" db:"role"`
	Plan         string     `json:"plan" db:"plan"`
	LastLoginAt  *time.Time `json:"last_login_at" db:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// UserPlan constants
const (
	PlanFree       = "free"
	PlanPro        = "pro"
	PlanEnterprise = "enterprise"
)

// NewUser creates a new user with validation
func NewUser(email, name, passwordHash string) (*User, error) {
	if err := validateEmail(email); err != nil {
		return nil, fmt.Errorf("invalid email: %w", err)
	}

	if err := validateName(name); err != nil {
		return nil, fmt.Errorf("invalid name: %w", err)
	}

	if passwordHash == "" {
		return nil, fmt.Errorf("password hash is required")
	}

	now := time.Now()
	return &User{
		ID:           uuid.New().String(),
		Email:        email,
		Name:         name,
		PasswordHash: passwordHash,
		Role:         string(RoleUser),
		Plan:         PlanFree,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// Validate validates the user entity
func (u *User) Validate() error {
	if u.ID == "" {
		return fmt.Errorf("user ID is required")
	}

	if err := validateEmail(u.Email); err != nil {
		return fmt.Errorf("invalid email: %w", err)
	}

	if err := validateName(u.Name); err != nil {
		return fmt.Errorf("invalid name: %w", err)
	}

	if u.PasswordHash == "" {
		return fmt.Errorf("password hash is required")
	}

	if !isValidRole(u.Role) {
		return fmt.Errorf("invalid role: %s", u.Role)
	}

	if !isValidPlan(u.Plan) {
		return fmt.Errorf("invalid plan: %s", u.Plan)
	}

	return nil
}

// UpdateProfile updates user profile information
func (u *User) UpdateProfile(name string) error {
	if err := validateName(name); err != nil {
		return fmt.Errorf("invalid name: %w", err)
	}

	u.Name = name
	u.UpdatedAt = time.Now()
	return nil
}

// SetRole sets the user role
func (u *User) SetRole(role string) error {
	if !isValidRole(role) {
		return fmt.Errorf("invalid role: %s", role)
	}

	u.Role = role
	u.UpdatedAt = time.Now()
	return nil
}

// SetPlan sets the user plan
func (u *User) SetPlan(plan string) error {
	if !isValidPlan(plan) {
		return fmt.Errorf("invalid plan: %s", plan)
	}

	u.Plan = plan
	u.UpdatedAt = time.Now()
	return nil
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == string(RoleAdmin)
}

// HasPlan checks if user has specific plan or higher
func (u *User) HasPlan(plan string) bool {
	planHierarchy := map[string]int{
		PlanFree:       0,
		PlanPro:        1,
		PlanEnterprise: 2,
	}

	userLevel, exists := planHierarchy[u.Plan]
	if !exists {
		return false
	}

	requiredLevel, exists := planHierarchy[plan]
	if !exists {
		return false
	}

	return userLevel >= requiredLevel
}

// SetPasswordHash sets the user's password hash
func (u *User) SetPasswordHash(passwordHash string) error {
	if passwordHash == "" {
		return fmt.Errorf("password hash is required")
	}

	u.PasswordHash = passwordHash
	u.UpdatedAt = time.Now()
	return nil
}

// UpdateLastLogin updates the user's last login timestamp
func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLoginAt = &now
	u.UpdatedAt = now
}

// Helper functions
func validateEmail(email string) error {
	if email == "" {
		return fmt.Errorf("email is required")
	}

	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !emailRegex.MatchString(email) {
		return fmt.Errorf("invalid email format")
	}

	return nil
}

func validateName(name string) error {
	if name == "" {
		return fmt.Errorf("name is required")
	}

	if len(name) < 2 {
		return fmt.Errorf("name must be at least 2 characters")
	}

	if len(name) > 100 {
		return fmt.Errorf("name must be less than 100 characters")
	}

	return nil
}

func isValidRole(role string) bool {
	return Role(role).IsValid()
}

func isValidPlan(plan string) bool {
	return plan == PlanFree || plan == PlanPro || plan == PlanEnterprise
}
