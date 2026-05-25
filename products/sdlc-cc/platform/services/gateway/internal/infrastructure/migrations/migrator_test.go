package migrations

import (
	"strings"
	"testing"
)

func TestValidateMigrations_DetectsDuplicateVersion(t *testing.T) {
	migs := []Migration{
		{Version: 15, Name: "dlp_tenant_policy"},
		{Version: 16, Name: "domain_verifications"},
		{Version: 15, Name: "idp_config"}, // version 15 claimed twice
	}
	err := validateMigrations(migs)
	if err == nil {
		t.Fatal("expected error for duplicate version 15, got nil")
	}
	if !strings.Contains(err.Error(), "15") {
		t.Fatalf("expected error to mention version 15, got: %v", err)
	}
	if !strings.Contains(err.Error(), "dlp_tenant_policy") || !strings.Contains(err.Error(), "idp_config") {
		t.Fatalf("expected error to name both conflicting migrations, got: %v", err)
	}
}

func TestValidateMigrations_AcceptsUniqueVersions(t *testing.T) {
	migs := []Migration{
		{Version: 15, Name: "dlp_tenant_policy"},
		{Version: 16, Name: "domain_verifications"},
		{Version: 17, Name: "idp_config"},
	}
	if err := validateMigrations(migs); err != nil {
		t.Fatalf("unexpected error for unique versions: %v", err)
	}
}

func TestValidateMigrations_EmptySliceIsValid(t *testing.T) {
	if err := validateMigrations(nil); err != nil {
		t.Fatalf("unexpected error for empty slice: %v", err)
	}
}
