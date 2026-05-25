package rbac

// Role defines a user role in the system.
type Role string

const (
	RoleAdmin          Role = "admin"
	RoleMaintainer     Role = "maintainer"
	RoleReleaseManager Role = "release_manager"
	RoleDeployApprover Role = "deploy_approver"
	RoleDeveloper      Role = "developer"
	RoleViewer         Role = "viewer"
	RoleAuditor        Role = "auditor"
)

// Permission defines an action that can be performed.
type Permission string

const (
	PermRunPipeline        Permission = "run_pipeline"
	PermDeploy             Permission = "deploy"
	PermManageSecrets      Permission = "manage_secrets"
	PermManageUsers        Permission = "manage_users"
	PermViewRuns           Permission = "view_runs"
	PermViewAuditLog       Permission = "view_audit_log"
	PermApproveGate        Permission = "approve_gate"
	PermManagePolicies     Permission = "manage_policies"
	PermManageProjectUsers Permission = "manage_project_users"
	PermManageEnvironments Permission = "manage_environments"
)

var rolePermissions = map[Role][]Permission{
	RoleAdmin: {
		PermRunPipeline, PermDeploy, PermManageSecrets, PermManageUsers,
		PermViewRuns, PermViewAuditLog, PermApproveGate, PermManagePolicies,
		PermManageProjectUsers, PermManageEnvironments,
	},
	RoleMaintainer: {
		PermRunPipeline, PermDeploy, PermManageSecrets, PermViewRuns,
		PermApproveGate, PermManagePolicies, PermManageProjectUsers,
		PermManageEnvironments,
	},
	RoleReleaseManager: {PermRunPipeline, PermDeploy, PermViewRuns},
	RoleDeployApprover: {PermViewRuns, PermViewAuditLog, PermApproveGate},
	RoleDeveloper:      {PermRunPipeline, PermViewRuns},
	RoleViewer:         {PermViewRuns},
	RoleAuditor:        {PermViewRuns, PermViewAuditLog},
}

// ProjectRoleBinding scopes a role to a specific project.
type ProjectRoleBinding struct {
	ProjectID    string
	Role         Role
	Environments []string
}

// User represents an authenticated user with roles.
type User struct {
	ID           string
	Email        string
	Roles        []Role
	ProjectRoles []ProjectRoleBinding
}

// HasPermission checks if a user has the given permission.
func (u *User) HasPermission(perm Permission) bool {
	return hasPermissionForRoles(u.Roles, perm)
}

// HasProjectPermission checks project-scoped roles.
func (u *User) HasProjectPermission(projectID, env string, perm Permission) bool {
	if u.HasPermission(perm) {
		return true
	}
	for _, b := range u.ProjectRoles {
		if b.ProjectID != projectID || !environmentAllowed(b.Environments, env) {
			continue
		}
		if roleHasPermission(b.Role, perm) {
			return true
		}
	}
	return false
}

// CanDeploy answers whether the user may deploy.
func (u *User) CanDeploy(projectID, env string) bool {
	return u.HasProjectPermission(projectID, env, PermDeploy)
}

// CanApproveGate answers whether the user may approve a gate.
func (u *User) CanApproveGate(projectID, env string) bool {
	return u.HasProjectPermission(projectID, env, PermApproveGate)
}
