package entities

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// Role represents a user role in the system
type Role string

const (
	RoleGuest     Role = "guest"
	RoleUser      Role = "user"
	RoleDeveloper Role = "developer"
	RoleAdmin     Role = "admin"
	RoleOwner     Role = "owner"
)

// IsValid checks if a role is valid
func (r Role) IsValid() bool {
	switch r {
	case RoleGuest, RoleUser, RoleDeveloper, RoleAdmin, RoleOwner:
		return true
	default:
		return false
	}
}

// HasMinimumAccess checks if role has at least the minimum access level
func (r Role) HasMinimumAccess(minimum Role) bool {
	levels := map[Role]int{
		RoleGuest:     0,
		RoleUser:      1,
		RoleDeveloper: 2,
		RoleAdmin:     3,
		RoleOwner:     4,
	}

	return levels[r] >= levels[minimum]
}

// Permission represents a specific permission
type Permission string

const (
	// User Permissions
	PermissionUserRead   Permission = "user:read"
	PermissionUserWrite  Permission = "user:write"
	PermissionUserDelete Permission = "user:delete"

	// Connection Permissions
	PermissionConnectionRead   Permission = "connection:read"
	PermissionConnectionWrite  Permission = "connection:write"
	PermissionConnectionDelete Permission = "connection:delete"
	PermissionConnectionTest   Permission = "connection:test"

	// Query Permissions
	PermissionQueryRead   Permission = "query:read"
	PermissionQueryWrite  Permission = "query:write"
	PermissionQueryDelete Permission = "query:delete"
	PermissionQueryExecute Permission = "query:execute"

	// Team Permissions
	PermissionTeamRead   Permission = "team:read"
	PermissionTeamWrite  Permission = "team:write"
	PermissionTeamDelete Permission = "team:delete"
	PermissionTeamInvite Permission = "team:invite"

	// Project Permissions
	PermissionProjectRead   Permission = "project:read"
	PermissionProjectWrite  Permission = "project:write"
	PermissionProjectDelete Permission = "project:delete"

	// Admin Permissions
	PermissionAdminRead    Permission = "admin:read"
	PermissionAdminWrite   Permission = "admin:write"
	PermissionAdminDelete  Permission = "admin:delete"
	PermissionAdminManage  Permission = "admin:manage"
)

// IsValid checks if a permission is valid
func (p Permission) IsValid() bool {
	validPermissions := []Permission{
		PermissionUserRead, PermissionUserWrite, PermissionUserDelete,
		PermissionConnectionRead, PermissionConnectionWrite, PermissionConnectionDelete, PermissionConnectionTest,
		PermissionQueryRead, PermissionQueryWrite, PermissionQueryDelete, PermissionQueryExecute,
		PermissionTeamRead, PermissionTeamWrite, PermissionTeamDelete, PermissionTeamInvite,
		PermissionProjectRead, PermissionProjectWrite, PermissionProjectDelete,
		PermissionAdminRead, PermissionAdminWrite, PermissionAdminDelete, PermissionAdminManage,
	}

	for _, valid := range validPermissions {
		if p == valid {
			return true
		}
	}
	return false
}

// ResourceType represents the type of resource
type ResourceType string

const (
	ResourceTypeUser       ResourceType = "user"
	ResourceTypeConnection ResourceType = "connection"
	ResourceTypeQuery      ResourceType = "query"
	ResourceTypeTeam       ResourceType = "team"
	ResourceTypeProject    ResourceType = "project"
	ResourceTypeSettings   ResourceType = "settings"
)

// RolePermission represents a role with its associated permissions
type RolePermission struct {
	ID          string     `json:"id" db:"id"`
	Role        Role       `json:"role" db:"role"`
	Permissions string     `json:"permissions" db:"permissions"` // Comma-separated
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// NewRolePermission creates a new role permission
func NewRolePermission(role Role, permissions []Permission) *RolePermission {
	now := time.Now()
	return &RolePermission{
		ID:          uuid.New().String(),
		Role:        role,
		Permissions: joinPermissions(permissions),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// GetPermissionList returns permissions as a slice
func (rp *RolePermission) GetPermissionList() []Permission {
	return splitPermissions(rp.Permissions)
}

// HasPermission checks if role has a specific permission
func (rp *RolePermission) HasPermission(permission Permission) bool {
	permissions := rp.GetPermissionList()
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// UserPermission represents a custom permission for a specific user
type UserPermission struct {
	ID           string       `json:"id" db:"id"`
	UserID       string       `json:"user_id" db:"user_id"`
	ResourceID   string       `json:"resource_id" db:"resource_id"`
	ResourceType ResourceType `json:"resource_type" db:"resource_type"`
	Permissions  string       `json:"permissions" db:"permissions"` // Comma-separated
	GrantedBy    string       `json:"granted_by" db:"granted_by"`
	ExpiresAt    *time.Time   `json:"expires_at" db:"expires_at"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`
}

// NewUserPermission creates a new user permission
func NewUserPermission(userID, resourceID string, resourceType ResourceType, permissions []Permission, grantedBy string, expiresAt *time.Time) *UserPermission {
	now := time.Now()
	return &UserPermission{
		ID:           uuid.New().String(),
		UserID:       userID,
		ResourceID:   resourceID,
		ResourceType: resourceType,
		Permissions:  joinPermissions(permissions),
		GrantedBy:    grantedBy,
		ExpiresAt:    expiresAt,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

// GetPermissionList returns permissions as a slice
func (up *UserPermission) GetPermissionList() []Permission {
	return splitPermissions(up.Permissions)
}

// HasPermission checks if user has a specific permission
func (up *UserPermission) HasPermission(permission Permission) bool {
	permissions := up.GetPermissionList()
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// IsExpired checks if the permission is expired
func (up *UserPermission) IsExpired() bool {
	if up.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*up.ExpiresAt)
}

// TeamPermission represents team-based permissions
type TeamPermission struct {
	ID           string       `json:"id" db:"id"`
	TeamID       string       `json:"team_id" db:"team_id"`
	Role         Role         `json:"role" db:"role"`
	Permissions  string       `json:"permissions" db:"permissions"` // Comma-separated
	ResourceID   *string      `json:"resource_id" db:"resource_id"` // Optional: for specific resource
	ResourceType *ResourceType `json:"resource_type" db:"resource_type"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`
}

// NewTeamPermission creates a new team permission
func NewTeamPermission(teamID string, role Role, permissions []Permission) *TeamPermission {
	now := time.Now()
	return &TeamPermission{
		ID:          uuid.New().String(),
		TeamID:      teamID,
		Role:        role,
		Permissions: joinPermissions(permissions),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// GetPermissionList returns permissions as a slice
func (tp *TeamPermission) GetPermissionList() []Permission {
	return splitPermissions(tp.Permissions)
}

// HasPermission checks if team has a specific permission
func (tp *TeamPermission) HasPermission(permission Permission) bool {
	permissions := tp.GetPermissionList()
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// Default role permissions
var DefaultRolePermissions = map[Role][]Permission{
	RoleGuest: {
		// Guest has minimal permissions
	},
	RoleUser: {
		PermissionUserRead,
		PermissionConnectionRead,
		PermissionQueryRead,
		PermissionQueryExecute,
		PermissionTeamRead,
		PermissionProjectRead,
	},
	RoleDeveloper: {
		PermissionUserRead,
		PermissionConnectionRead,
		PermissionConnectionWrite,
		PermissionConnectionTest,
		PermissionQueryRead,
		PermissionQueryWrite,
		PermissionQueryExecute,
		PermissionTeamRead,
		PermissionProjectRead,
		PermissionProjectWrite,
	},
	RoleAdmin: {
		PermissionUserRead,
		PermissionUserWrite,
		PermissionConnectionRead,
		PermissionConnectionWrite,
		PermissionConnectionDelete,
		PermissionConnectionTest,
		PermissionQueryRead,
		PermissionQueryWrite,
		PermissionQueryDelete,
		PermissionQueryExecute,
		PermissionTeamRead,
		PermissionTeamWrite,
		PermissionTeamInvite,
		PermissionProjectRead,
		PermissionProjectWrite,
		PermissionProjectDelete,
		PermissionAdminRead,
	},
	RoleOwner: {
		// Owner has all permissions
		PermissionUserRead,
		PermissionUserWrite,
		PermissionUserDelete,
		PermissionConnectionRead,
		PermissionConnectionWrite,
		PermissionConnectionDelete,
		PermissionConnectionTest,
		PermissionQueryRead,
		PermissionQueryWrite,
		PermissionQueryDelete,
		PermissionQueryExecute,
		PermissionTeamRead,
		PermissionTeamWrite,
		PermissionTeamDelete,
		PermissionTeamInvite,
		PermissionProjectRead,
		PermissionProjectWrite,
		PermissionProjectDelete,
		PermissionAdminRead,
		PermissionAdminWrite,
		PermissionAdminDelete,
		PermissionAdminManage,
	},
}

// Helper functions

func joinPermissions(permissions []Permission) string {
	if len(permissions) == 0 {
		return ""
	}
	strPermissions := make([]string, len(permissions))
	for i, p := range permissions {
		strPermissions[i] = string(p)
	}
	return strings.Join(strPermissions, ",")
}

func splitPermissions(permissions string) []Permission {
	if permissions == "" {
		return []Permission{}
	}
	parts := strings.Split(permissions, ",")
	result := make([]Permission, 0, len(parts))
	for _, part := range parts {
		p := Permission(part)
		if p.IsValid() {
			result = append(result, p)
		}
	}
	return result
}
