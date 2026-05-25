package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TestPEPEnrichmentPromotesFirstClassFields verifies that the PEP
// enricher populates the new Tier 2/3 columns (pep_tier, gender,
// place_of_birth, position_title) on domain.Entity, not just metadata.
func TestPEPEnrichmentPromotesFirstClassFields(t *testing.T) {
	ent := domain.Entity{
		Metadata: map[string]interface{}{"schemaType": "Person"},
	}
	props := map[string][]string{
		"birthDate":  {"1970-05-01"},
		"gender":     {"female"},
		"birthPlace": {"Buenos Aires, Argentina"},
		"position":   {"Senator"},
		"topics":     {"role.pep"},
	}
	enrichPEPFromProps(&ent, props)

	if ent.Gender != "female" {
		t.Errorf("Gender = %q, want female", ent.Gender)
	}
	if ent.PlaceOfBirth != "Buenos Aires, Argentina" {
		t.Errorf("PlaceOfBirth = %q, want Buenos Aires...", ent.PlaceOfBirth)
	}
	if ent.PositionTitle != "Senator" {
		t.Errorf("PositionTitle = %q, want Senator", ent.PositionTitle)
	}
	if ent.PEPTier != domain.PEPTier2 {
		// "Senator" matches pepTier2Keywords
		t.Errorf("PEPTier = %v, want Tier2", ent.PEPTier)
	}
	if m := ent.Metadata["pep_tier"]; m != "PEP" {
		t.Errorf("metadata.pep_tier = %v, want PEP", m)
	}
}

func TestPEPEnrichmentSanctionTierBeatsPEP(t *testing.T) {
	ent := domain.Entity{
		Metadata: map[string]interface{}{"schemaType": "Person"},
	}
	props := map[string][]string{
		"position": {"Mayor"},
		"topics":   {"role.pep", "sanction.crime"},
	}
	enrichPEPFromProps(&ent, props)

	// classifyPEPTier runs first (Mayor -> Tier3), then setPepTier
	// upgrades to Tier1 because "sanction" topic wins.
	if ent.PEPTier != domain.PEPTier3 && ent.PEPTier != domain.PEPTier1 {
		t.Errorf("PEPTier = %v, expected Tier1 or Tier3", ent.PEPTier)
	}
	if m := ent.Metadata["pep_tier"]; m != "SANCTION" {
		t.Errorf("metadata.pep_tier = %v, want SANCTION", m)
	}
}
