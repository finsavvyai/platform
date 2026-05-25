package api

import "testing"

func TestPickRole(t *testing.T) {
	tests := []struct {
		name     string
		attrs    map[string]string
		roleAttr string
		roleMap  map[string]string
		want     string
	}{
		{"default attribute, no map",
			map[string]string{"role": "admin"}, "", nil, "admin"},
		{"tenant attribute overrides default",
			map[string]string{
				"https://customer.example.com/groups": "compliance",
				"role": "viewer", // ignored — tenant attr wins
			},
			"https://customer.example.com/groups",
			map[string]string{"compliance": "admin"},
			"admin"},
		{"role map translates IdP value",
			map[string]string{"role": "compliance_officer"}, "",
			map[string]string{"compliance_officer": "admin"},
			"admin"},
		{"value not in map → passthrough",
			map[string]string{"role": "intern"}, "",
			map[string]string{"officer": "admin"},
			"intern"},
		{"empty IdP claim → fallback",
			map[string]string{}, "", nil, "viewer"},
		{"empty mapped value → passthrough (don't blank the role)",
			map[string]string{"role": "officer"}, "",
			map[string]string{"officer": ""},
			"officer"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pickRole(tt.attrs, tt.roleAttr, tt.roleMap, "viewer")
			if got != tt.want {
				t.Errorf("pickRole = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestExtractSSOAttrs_TenantRoleMapping locks in the end-to-end map:
// IdP claim 'compliance_officer' under a custom attribute, with a
// tenant role_map translating it to 'admin'. This is the canonical
// bank IT setup — they want their LDAP groups translated to aegis
// roles without a code change.
func TestExtractSSOAttrs_TenantRoleMapping(t *testing.T) {
	attrs := map[string]string{
		"nameID": "u1",
		"email":  "officer@bank.example.com",
		"https://customer.example.com/groups": "compliance_officer",
	}
	roleMap := map[string]string{"compliance_officer": "admin"}
	got, err := extractSSOAttrs(attrs,
		"https://customer.example.com/groups", roleMap)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got.Role != "admin" {
		t.Errorf("role: got %q want admin", got.Role)
	}
	if got.Email != "officer@bank.example.com" {
		t.Errorf("email: got %q", got.Email)
	}
}
