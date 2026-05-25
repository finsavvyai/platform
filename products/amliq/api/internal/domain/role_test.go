package domain

import "testing"

func TestParseRole(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Role
		wantErr bool
	}{
		{"admin", "admin", RoleAdmin, false},
		{"analyst", "analyst", RoleAnalyst, false},
		{"auditor", "auditor", RoleAuditor, false},
		{"viewer", "viewer", RoleViewer, false},
		{"invalid", "superuser", "", true},
		{"empty", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseRole(tt.input)
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRolePermissions(t *testing.T) {
	tests := []struct {
		name      string
		role      Role
		canWrite  bool
		canManage bool
		canAudit  bool
		canConfig bool
	}{
		{"admin", RoleAdmin, true, true, true, true},
		{"analyst", RoleAnalyst, true, false, false, false},
		{"auditor", RoleAuditor, false, false, true, false},
		{"viewer", RoleViewer, false, false, false, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.role.CanWrite() != tt.canWrite {
				t.Errorf("CanWrite: got %v", tt.role.CanWrite())
			}
			if tt.role.CanManageTeam() != tt.canManage {
				t.Errorf("CanManageTeam: got %v", tt.role.CanManageTeam())
			}
			if tt.role.CanViewAudit() != tt.canAudit {
				t.Errorf("CanViewAudit: got %v", tt.role.CanViewAudit())
			}
			if tt.role.CanEditConfig() != tt.canConfig {
				t.Errorf("CanEditConfig: got %v", tt.role.CanEditConfig())
			}
		})
	}
}
