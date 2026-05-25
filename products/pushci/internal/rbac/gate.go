package rbac

// HasRole checks if a user has a specific role.
func (u *User) HasRole(role Role) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

func hasPermissionForRoles(roles []Role, perm Permission) bool {
	for _, role := range roles {
		if roleHasPermission(role, perm) {
			return true
		}
	}
	return false
}

func roleHasPermission(role Role, perm Permission) bool {
	perms := rolePermissions[role]
	for _, p := range perms {
		if p == perm {
			return true
		}
	}
	return false
}

func environmentAllowed(environments []string, target string) bool {
	if len(environments) == 0 || target == "" {
		return true
	}
	for _, environment := range environments {
		if environment == target {
			return true
		}
	}
	return false
}

// ApprovalGate requires N approvers before deployment.
type ApprovalGate struct {
	Required  int
	Approvers []string
}

// NewGate creates an approval gate requiring N approvers.
func NewGate(required int) *ApprovalGate {
	return &ApprovalGate{Required: required}
}

// Approve adds an approver. Returns true if gate is now satisfied.
func (g *ApprovalGate) Approve(userID string) bool {
	for _, a := range g.Approvers {
		if a == userID {
			return g.IsSatisfied()
		}
	}
	g.Approvers = append(g.Approvers, userID)
	return g.IsSatisfied()
}

// IsSatisfied returns true if enough approvals exist.
func (g *ApprovalGate) IsSatisfied() bool {
	return len(g.Approvers) >= g.Required
}
