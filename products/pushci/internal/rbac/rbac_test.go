package rbac

import "testing"

func TestUserPermissions(t *testing.T) {
	tests := []struct {
		name string
		role Role
		perm Permission
		want bool
	}{
		{"admin can deploy", RoleAdmin, PermDeploy, true},
		{"admin can manage users", RoleAdmin, PermManageUsers, true},
		{"maintainer can manage project users", RoleMaintainer, PermManageProjectUsers, true},
		{"release manager can deploy", RoleReleaseManager, PermDeploy, true},
		{"release manager cannot approve gates", RoleReleaseManager, PermApproveGate, false},
		{"deploy approver can approve", RoleDeployApprover, PermApproveGate, true},
		{"deploy approver cannot deploy", RoleDeployApprover, PermDeploy, false},
		{"dev can run", RoleDeveloper, PermRunPipeline, true},
		{"dev cannot deploy", RoleDeveloper, PermDeploy, false},
		{"dev cannot manage users", RoleDeveloper, PermManageUsers, false},
		{"viewer can view", RoleViewer, PermViewRuns, true},
		{"viewer cannot deploy", RoleViewer, PermDeploy, false},
		{"auditor can view audit", RoleAuditor, PermViewAuditLog, true},
		{"auditor cannot deploy", RoleAuditor, PermDeploy, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{ID: "1", Roles: []Role{tt.role}}
			if u.HasPermission(tt.perm) != tt.want {
				t.Errorf("HasPermission(%s) = %v, want %v", tt.perm, !tt.want, tt.want)
			}
		})
	}
}

func TestProjectScopedPermissions(t *testing.T) {
	u := &User{
		ID: "1",
		ProjectRoles: []ProjectRoleBinding{
			{ProjectID: "project-a", Role: RoleReleaseManager, Environments: []string{"staging"}},
			{ProjectID: "project-a", Role: RoleDeployApprover, Environments: []string{"production"}},
		},
	}

	if !u.CanDeploy("project-a", "staging") {
		t.Fatal("expected staging deploy permission from project-scoped release manager role")
	}
	if u.CanDeploy("project-a", "production") {
		t.Fatal("did not expect production deploy permission without matching environment binding")
	}
	if !u.CanApproveGate("project-a", "production") {
		t.Fatal("expected production gate approval permission from project-scoped deploy approver role")
	}
	if u.CanApproveGate("project-b", "production") {
		t.Fatal("did not expect cross-project approval permission")
	}
}

func TestGlobalAdminOverridesProjectScope(t *testing.T) {
	u := &User{ID: "1", Roles: []Role{RoleAdmin}}
	if !u.CanDeploy("project-a", "production") {
		t.Fatal("expected global admin deploy permission")
	}
	if !u.CanApproveGate("project-a", "production") {
		t.Fatal("expected global admin approval permission")
	}
}

func TestApprovalGate(t *testing.T) {
	g := NewGate(2)
	if g.IsSatisfied() {
		t.Error("gate should not be satisfied with 0 approvers")
	}
	g.Approve("user-1")
	if g.IsSatisfied() {
		t.Error("gate needs 2 approvers")
	}
	g.Approve("user-1") // duplicate
	if g.IsSatisfied() {
		t.Error("duplicate should not count")
	}
	g.Approve("user-2")
	if !g.IsSatisfied() {
		t.Error("gate should be satisfied with 2 approvers")
	}
}
