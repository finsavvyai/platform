package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func newTestEntity(t *testing.T) *domain.Entity {
	t.Helper()
	id, _ := domain.NewEntityID("ent_test0000")
	n, _ := domain.NewName("Test Name", "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
	if err != nil {
		t.Fatalf("NewEntity: %v", err)
	}
	return &ent
}

func TestEnrichBulkFromProps(t *testing.T) {
	tests := []struct {
		name    string
		props   map[string][]string
		metaKey string
		want    string
	}{
		{"birth_place", map[string][]string{"birthPlace": {"Tehran"}}, "birth_place", "Tehran"},
		{"gender", map[string][]string{"gender": {"male"}}, "gender", "male"},
		{"position", map[string][]string{"position": {"Minister"}}, "position", "Minister"},
		{"source_url", map[string][]string{"sourceUrl": {"https://x.test/a"}}, "source_url", "https://x.test/a"},
		{"programs", map[string][]string{"program": {"SDN", "SDGT"}}, "programs", "SDN; SDGT"},
		{"aliases", map[string][]string{"alias": {"A", "B"}}, "aliases", "A; B"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ent := newTestEntity(t)
			enrichBulkFromProps(ent, tt.props)
			if got, _ := ent.Metadata[tt.metaKey].(string); got != tt.want {
				t.Errorf("meta[%q] = %q, want %q", tt.metaKey, got, tt.want)
			}
		})
	}
}

func TestEnrichBulkContactAndIDs(t *testing.T) {
	ent := newTestEntity(t)
	props := map[string][]string{
		"email":          {"a@x.test"},
		"phone":          {"+1-555"},
		"website":        {"https://y.test"},
		"passportNumber": {"P123"},
		"idNumber":       {"ID456"},
		"address":        {"1 Main St"},
		"topics":         {"role.pep"},
	}
	enrichBulkFromProps(ent, props)

	if emails, _ := ent.Metadata["emails"].([]interface{}); len(emails) != 1 {
		t.Errorf("emails = %v, want 1 entry", ent.Metadata["emails"])
	}
	if len(ent.Identifiers) != 2 {
		t.Errorf("identifiers = %d, want 2", len(ent.Identifiers))
	}
	if len(ent.Addresses) != 1 {
		t.Errorf("addresses = %d, want 1", len(ent.Addresses))
	}
	if tier, _ := ent.Metadata["pep_tier"].(string); tier != "PEP" {
		t.Errorf("pep_tier = %q, want PEP", tier)
	}
}

func TestSetPepTierSanctionWins(t *testing.T) {
	ent := newTestEntity(t)
	setPepTier(ent, []string{"role.pep", "sanction.crime"})
	if tier, _ := ent.Metadata["pep_tier"].(string); tier != "SANCTION" {
		t.Errorf("pep_tier = %q, want SANCTION", tier)
	}
}

func TestEnrichBulkFromHeaderDatasetKey(t *testing.T) {
	ent := newTestEntity(t)
	hdr := buildHeaderIndex([]string{"id", "datasets", "schema"})
	rec := []string{"Q1", "us_ofac_sdn", "Person"}
	enrichBulkFromHeader(ent, hdr, rec)
	if got, _ := ent.Metadata["dataset"].(string); got != "us_ofac_sdn" {
		t.Errorf("dataset = %q, want us_ofac_sdn", got)
	}
	if got, _ := ent.Metadata["schemaType"].(string); got != "Person" {
		t.Errorf("schemaType = %q, want Person", got)
	}
}
