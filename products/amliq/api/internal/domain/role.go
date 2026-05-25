package domain

import "fmt"

// Role represents a user's permission level within a tenant.
type Role string

const (
	RoleAdmin   Role = "admin"
	RoleAnalyst Role = "analyst"
	RoleAuditor Role = "auditor"
	RoleViewer  Role = "viewer"
)

var validRoles = map[Role]bool{
	RoleAdmin: true, RoleAnalyst: true,
	RoleAuditor: true, RoleViewer: true,
}

func ParseRole(s string) (Role, error) {
	r := Role(s)
	if !validRoles[r] {
		return "", fmt.Errorf("invalid role: %s", s)
	}
	return r, nil
}

func (r Role) String() string { return string(r) }

// CanWrite returns true if the role can modify data.
func (r Role) CanWrite() bool {
	return r == RoleAdmin || r == RoleAnalyst
}

// CanResolve returns true if the role can resolve alerts.
func (r Role) CanResolve() bool {
	return r == RoleAdmin || r == RoleAnalyst
}

// CanManageTeam returns true if the role can invite/remove users.
func (r Role) CanManageTeam() bool {
	return r == RoleAdmin
}

// CanViewAudit returns true if the role can view audit trail.
func (r Role) CanViewAudit() bool {
	return r == RoleAdmin || r == RoleAuditor
}

// CanEditConfig returns true if the role can change tenant config.
func (r Role) CanEditConfig() bool {
	return r == RoleAdmin
}
