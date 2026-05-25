package saml

import (
	"context"
	"errors"
	"testing"
)

// TestSQLLoader_Load_NotFound asserts the no-row branch maps to the
// typed error so handlers can 404 instead of 500.
func TestSQLLoader_Load_NotFound(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	loader := NewSQLLoader(db)
	_, err := loader.Load(context.Background(), "tnt_doesnotexist0")
	if !errors.Is(err, ErrTenantSAMLNotConfigured) {
		t.Errorf("expected ErrTenantSAMLNotConfigured, got %v", err)
	}
}

// TestSQLLoader_Load_DisabledTreatedAsAbsent locks in the partial-
// index-style behaviour: a disabled row must not surface, otherwise
// a customer cutting SSO would still see stale assertions accepted.
func TestSQLLoader_Load_DisabledTreatedAsAbsent(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	mustInsertTenant(t, db, "tnt_disabled000000")
	mustInsertSAML(t, db, "tnt_disabled000000", false)
	loader := NewSQLLoader(db)
	_, err := loader.Load(context.Background(), "tnt_disabled000000")
	if !errors.Is(err, ErrTenantSAMLNotConfigured) {
		t.Errorf("disabled row leaked: %v", err)
	}
}

// TestSQLLoader_Load_HappyPath exercises the actual scan path against
// real columns. Caught a class of real-world bug during dev where the
// scan order mismatched the SELECT — silent corruption otherwise.
func TestSQLLoader_Load_HappyPath(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	mustInsertTenant(t, db, "tnt_happy00000000")
	mustInsertSAML(t, db, "tnt_happy00000000", true)
	loader := NewSQLLoader(db)
	row, err := loader.Load(context.Background(), "tnt_happy00000000")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if row.TenantID != "tnt_happy00000000" {
		t.Errorf("TenantID drift: %q", row.TenantID)
	}
	if row.IDPEntityID != "https://idp.example.com/exk" {
		t.Errorf("IDPEntityID drift: %q", row.IDPEntityID)
	}
	if !row.Enabled {
		t.Error("Enabled false on happy-path row")
	}
}

// TestPerTenantFactory_Provider_NotConfigured covers the factory-
// level error wrapping that handlers depend on for the 404 path.
func TestPerTenantFactory_Provider_NotConfigured(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()
	setupSchema(t, db)
	loader := NewSQLLoader(db)
	f := NewPerTenantFactory(loader, "https://aegis.cc")
	_, err := f.Provider(context.Background(), "tnt_missing000000")
	if !errors.Is(err, ErrTenantSAMLNotConfigured) {
		t.Errorf("expected typed error, got %v", err)
	}
}
