package models

import (
	"time"

	"github.com/google/uuid"
)

// UserRole represents the role assigned to a user within a tenant.
type UserRole string

const (
	RoleUser          UserRole = "user"
	RoleAdmin         UserRole = "admin"
	RoleSuperAdmin    UserRole = "super_admin"
	RoleTenantAdmin   UserRole = "tenant_admin"
	RoleAnalyst       UserRole = "analyst"
	RoleViewer        UserRole = "viewer"
	RoleDataScientist UserRole = "data_scientist"
)

// NewUser constructs a domain User with sensible defaults. Used by the
// admin CreateUser handler; password handling happens elsewhere. The
// optional `name` arg seeds Profile["name"] so handlers don't have to
// post-process.
func NewUser(tenantID uuid.UUID, email, name string, role UserRole) *User {
	now := time.Now()
	profile := JSONB{}
	if name != "" {
		profile["name"] = name
	}
	return &User{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Email:       email,
		Role:        role,
		IsActive:    true,
		Profile:     profile,
		Preferences: JSONB{},
		Permissions: JSONB{},
		Metadata:    JSONB{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// IsAdmin returns true when the user has any admin-tier role. Convenience
// shortcut for handlers that gate on "admin or above".
func (u *User) IsAdmin() bool {
	if u == nil {
		return false
	}
	return u.Role == RoleAdmin || u.Role == RoleSuperAdmin || u.Role == RoleTenantAdmin
}

// IsLocked reports whether the account is currently locked out.
func (u *User) IsLocked() bool {
	if u == nil || u.LockedUntil == nil {
		return false
	}
	return u.LockedUntil.After(time.Now())
}

// LockAccount sets a lockout window of the given duration from now.
func (u *User) LockAccount(d time.Duration) {
	if u == nil {
		return
	}
	until := time.Now().Add(d)
	u.LockedUntil = &until
	u.UpdatedAt = time.Now()
}

// UnlockAccount clears any active lockout.
func (u *User) UnlockAccount() {
	if u == nil {
		return
	}
	u.LockedUntil = nil
	u.FailedLoginAttempts = 0
	u.UpdatedAt = time.Now()
}

// IncrementFailedLogin bumps the failed-login counter and locks the
// account for 15 minutes after 5 consecutive failures.
func (u *User) IncrementFailedLogin() {
	if u == nil {
		return
	}
	u.FailedLoginAttempts++
	if u.FailedLoginAttempts >= 5 {
		u.LockAccount(15 * time.Minute)
	}
	u.UpdatedAt = time.Now()
}

// ResetFailedLogin clears the failed-login counter on a successful sign-in.
func (u *User) ResetFailedLogin() {
	if u == nil {
		return
	}
	u.FailedLoginAttempts = 0
	u.UpdatedAt = time.Now()
}

// User is the core domain model for platform users.
type User struct {
	ID                  uuid.UUID  `json:"id"                    db:"id"`
	TenantID            uuid.UUID  `json:"tenant_id"             db:"tenant_id"`
	Email               string     `json:"email"                 db:"email"`
	PasswordHash        string     `json:"-"                     db:"password_hash"`
	Role                UserRole   `json:"role"                  db:"role"`
	IsActive            bool       `json:"is_active"             db:"is_active"`
	EmailVerified       bool       `json:"email_verified"        db:"email_verified"`
	PhoneVerified       bool       `json:"phone_verified"        db:"phone_verified"`
	MFAEnabled          bool       `json:"mfa_enabled"           db:"mfa_enabled"`
	MFASecret           []byte     `json:"-"                     db:"mfa_secret"`
	FailedLoginAttempts int        `json:"failed_login_attempts" db:"failed_login_attempts"`
	LockedUntil         *time.Time `json:"locked_until,omitempty" db:"locked_until"`
	LastLogin           *time.Time `json:"last_login,omitempty"  db:"last_login"`
	PhoneNumber         string     `json:"phone_number,omitempty" db:"phone_number"`
	Profile             JSONB      `json:"profile"                db:"profile"`
	Preferences         JSONB      `json:"preferences"            db:"preferences"`
	Permissions         JSONB      `json:"permissions"            db:"permissions"`
	Metadata            JSONB      `json:"metadata"               db:"metadata"`
	CreatedAt           time.Time  `json:"created_at"             db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"             db:"updated_at"`
}

// HasPermission returns true when the user has the given permission
// string. Permissions is stored as a JSONB structure; this scan handles
// both the "permissions: []" and the flat-bool-map shapes used today.
// Missing / malformed data returns false (deny by default).
func (u *User) HasPermission(permission string) bool {
	if u == nil {
		return false
	}
	if perms, ok := u.Permissions["permissions"]; ok {
		if arr, ok := perms.([]interface{}); ok {
			for _, p := range arr {
				if s, ok := p.(string); ok && s == permission {
					return true
				}
			}
		}
	}
	if v, ok := u.Permissions[permission]; ok {
		if b, ok := v.(bool); ok && b {
			return true
		}
	}
	return false
}

// UserFilter holds optional filter criteria for user queries.
type UserFilter struct {
	TenantID      *uuid.UUID `json:"tenant_id,omitempty"`
	Role          *UserRole  `json:"role,omitempty"`
	IsActive      *bool      `json:"is_active,omitempty"`
	EmailVerified *bool      `json:"email_verified,omitempty"`
	Search        *string    `json:"search,omitempty"`
	Limit         *int       `json:"limit,omitempty"`
	Offset        *int       `json:"offset,omitempty"`
}

// UserSession tracks an authenticated user session.
type UserSession struct {
	ID                uuid.UUID  `json:"id"                  db:"id"`
	UserID            uuid.UUID  `json:"user_id"             db:"user_id"`
	TenantID          uuid.UUID  `json:"tenant_id"           db:"tenant_id"`
	SessionToken      string     `json:"-"                   db:"session_token"`
	RefreshToken      string     `json:"-"                   db:"refresh_token"`
	IPAddress         string     `json:"ip_address"          db:"ip_address"`
	UserAgent         string     `json:"user_agent"          db:"user_agent"`
	ExpiresAt         time.Time  `json:"expires_at"          db:"expires_at"`
	DeviceFingerprint string     `json:"device_fingerprint"  db:"device_fingerprint"`
	LastActivity      *time.Time `json:"last_activity,omitempty" db:"last_activity"`
	IsActive          bool       `json:"is_active"           db:"is_active"`
	Metadata          JSONB      `json:"metadata"            db:"metadata"`
	CreatedAt         time.Time  `json:"created_at"          db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"          db:"updated_at"`
}

// NewUserSession constructs a new UserSession with a generated ID.
func NewUserSession(userID, tenantID uuid.UUID, ipAddress, userAgent string, expiresAt time.Time) *UserSession {
	return &UserSession{
		ID:        uuid.New(),
		UserID:    userID,
		TenantID:  tenantID,
		IPAddress: ipAddress,
		UserAgent: userAgent,
		ExpiresAt: expiresAt,
		IsActive:  true,
		Metadata:  JSONB{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}
