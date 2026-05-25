package ingestion

import (
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestPepQueryContainsCountry(t *testing.T) {
	tests := []struct{ qid, want string }{
		{"Q30", "wd:Q30"}, {"Q148", "wd:Q148"},
	}
	for _, tc := range tests {
		if !strings.Contains(pepQuery(tc.qid), tc.want) {
			t.Errorf("pepQuery(%s) missing %s", tc.qid, tc.want)
		}
	}
}

func TestRcaQueryContainsPEP(t *testing.T) {
	if !strings.Contains(rcaQuery("Q42"), "wd:Q42") {
		t.Error("rcaQuery missing PEP QID")
	}
}

func TestSoeQueryContainsCountry(t *testing.T) {
	if !strings.Contains(soeQuery("Q30"), "wd:Q30") {
		t.Error("soeQuery missing country QID")
	}
}

func TestExtractQID(t *testing.T) {
	tests := []struct{ uri, want string }{
		{"http://www.wikidata.org/entity/Q42", "Q42"},
		{"Q100", "Q100"}, {"", ""},
	}
	for _, tc := range tests {
		if got := extractQID(tc.uri); got != tc.want {
			t.Errorf("extractQID(%q) = %q, want %q", tc.uri, got, tc.want)
		}
	}
}

func TestGetQIDKnownCountries(t *testing.T) {
	tests := []struct{ code, want string }{
		{"US", "Q30"}, {"IL", "Q801"}, {"RU", "Q159"},
		{"CN", "Q148"}, {"XX", ""},
	}
	for _, tc := range tests {
		if got := GetQID(tc.code); got != tc.want {
			t.Errorf("GetQID(%q) = %q, want %q", tc.code, got, tc.want)
		}
	}
}

func TestParsePEPResults(t *testing.T) {
	resp := sparqlResponse{Results: sparqlResults{Bindings: []sparqlBinding{
		{"person": {Val: "http://www.wikidata.org/entity/Q76"},
			"personLabel":   {Val: "Barack Obama"},
			"positionLabel": {Val: "President of the United States"}},
	}}}
	profiles := parsePEPResults(resp, "US")
	if len(profiles) != 1 {
		t.Fatalf("got %d profiles, want 1", len(profiles))
	}
	if profiles[0].Tier != domain.PEPTier1 {
		t.Errorf("tier = %v, want Tier1", profiles[0].Tier)
	}
	if profiles[0].EntityID != "Q76" {
		t.Errorf("entityID = %s, want Q76", profiles[0].EntityID)
	}
}

func TestParsePEPResultsDedup(t *testing.T) {
	resp := sparqlResponse{Results: sparqlResults{Bindings: []sparqlBinding{
		{"person": {Val: "http://www.wikidata.org/entity/Q76"},
			"positionLabel": {Val: "President"}},
		{"person": {Val: "http://www.wikidata.org/entity/Q76"},
			"positionLabel": {Val: "Senator"}},
	}}}
	profiles := parsePEPResults(resp, "US")
	if len(profiles) != 1 {
		t.Errorf("got %d profiles, want 1 (dedup)", len(profiles))
	}
}

func TestAllCountryCodesNotEmpty(t *testing.T) {
	codes := AllCountryCodes()
	if len(codes) < 100 {
		t.Errorf("AllCountryCodes() = %d, want >= 100", len(codes))
	}
}
