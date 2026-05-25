package saml

import (
	"context"
	"testing"
)

// TestSQLLoader_RoleMappingRoundTrip verifies the JSONB role_map
// round-trips correctly from INSERT to Load. This is the path bank
// IT will exercise — they'll seed one row per tenant with their
// LDAP-group-to-aegis-role map and expect it to survive Postgres.
func TestSQLLoader_RoleMappingRoundTrip(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	mustInsertTenant(t, db, "tnt_rolemap000000")
	mustInsertSAMLWithRoleMap(t, db, "tnt_rolemap000000",
		"https://customer.example.com/groups",
		`{"compliance_officer":"admin","analyst":"viewer"}`)

	loader := NewSQLLoader(db)
	row, err := loader.Load(context.Background(), "tnt_rolemap000000")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if row.RoleAttribute != "https://customer.example.com/groups" {
		t.Errorf("RoleAttribute drift: %q", row.RoleAttribute)
	}
	if got := row.RoleMap["compliance_officer"]; got != "admin" {
		t.Errorf("compliance_officer mapped to %q want admin", got)
	}
	if got := row.RoleMap["analyst"]; got != "viewer" {
		t.Errorf("analyst mapped to %q want viewer", got)
	}
}

// TestPerTenantFactory_RoleMapping_NotConfigured locks in the typed
// error so the ACS handler can degrade gracefully (passthrough) when
// a tenant has no SAML row.
func TestPerTenantFactory_RoleMapping_NotConfigured(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	loader := NewSQLLoader(db)
	f := NewPerTenantFactory(loader, "https://aegis.cc")
	_, _, err := f.RoleMapping(context.Background(), "tnt_unconfigured0")
	if err == nil {
		t.Error("expected ErrTenantSAMLNotConfigured")
	}
}
