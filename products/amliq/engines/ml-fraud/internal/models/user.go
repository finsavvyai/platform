package models

import (
	"time"

	"gorm.io/gorm"
)

// UserRole represents the role of a user in the system
type UserRole string

const (
	UserRoleAdmin      UserRole = "admin"
	UserRoleDeveloper  UserRole = "developer"
	UserRoleViewer     UserRole = "viewer"
	UserRoleEnterprise UserRole = "enterprise"
)

// User represents a system user
type User struct {
	UserID         string     `json:"user_id" db:"user_id" gorm:"primaryKey;type:varchar(255)" validate:"required,max=255"`
	Email          string     `json:"email" db:"email" gorm:"type:varchar(255);not null;uniqueIndex" validate:"required,email,max=255"`
	Role           UserRole   `json:"role" db:"role" gorm:"type:varchar(20);not null" validate:"required,oneof=admin developer viewer enterprise"`
	FirstName      string     `json:"first_name" db:"first_name" gorm:"type:varchar(100)" validate:"omitempty,max=100"`
	LastName       string     `json:"last_name" db:"last_name" gorm:"type:varchar(100)" validate:"omitempty,max=100"`
	Company        string     `json:"company" db:"company" gorm:"type:varchar(255)" validate:"omitempty,max=255"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at" gorm:"autoUpdateTime"`
	LastLogin      *time.Time `json:"last_login,omitempty" db:"last_login"`
	IsActive       bool       `json:"is_active" db:"is_active" gorm:"default:true"`
	SSOProvider    *string    `json:"sso_provider,omitempty" db:"sso_provider" gorm:"type:varchar(50)" validate:"omitempty,max=50"`
	SSOSubject     *string    `json:"sso_subject,omitempty" db:"sso_subject" gorm:"type:varchar(255)" validate:"omitempty,max=255"`
	LemonSqueezyID *string    `json:"lemonsqueezy_id,omitempty" db:"lemonsqueezy_id" gorm:"type:varchar(255)" validate:"omitempty,max=255"`

	// Relationships
	APIKeys []APIKey `json:"api_keys,omitempty" gorm:"foreignKey:UserID;references:UserID"`
}

// TableName returns the table name for GORM
func (User) TableName() string {
	return "users"
}

// BeforeCreate is a GORM hook that runs before creating a record
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.UserID == "" {
		u.UserID = generateUserID()
	}
	return nil
}

// FullName returns the user's full name
func (u *User) FullName() string {
	if u.FirstName == "" && u.LastName == "" {
		return ""
	}
	return u.FirstName + " " + u.LastName
}

// IsAdmin returns true if the user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == UserRoleAdmin
}

// CanAccessEnterprise returns true if the user can access enterprise features
func (u *User) CanAccessEnterprise() bool {
	return u.Role == UserRoleAdmin || u.Role == UserRoleEnterprise
}

// UpdateLastLogin updates the last login timestamp
func (u *User) UpdateLastLogin() {
	now := time.Now()
	u.LastLogin = &now
}

// Deactivate deactivates the user account
func (u *User) Deactivate() {
	u.IsActive = false
}

// Activate activates the user account
func (u *User) Activate() {
	u.IsActive = true
}

// Validate performs custom validation on the user
func (u *User) Validate() error {
	if u.Email == "" {
		return ErrInvalidEmail
	}

	if u.SSOProvider != nil && u.SSOSubject == nil {
		return ErrInvalidSSOConfig
	}

	return nil
}

// generateUserID generates a unique user ID
func generateUserID() string {
	// This would typically use a UUID library or similar
	// For now, using a simple timestamp-based approach
	return "user_" + time.Now().Format("20060102150405")
}
