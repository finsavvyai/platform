package domain

import (
	"testing"
)

func TestSuggestedListsIsrael(t *testing.T) {
	lists := SuggestedLists("IL")
	if len(lists) < 3 {
		t.Errorf("Israel should have at least 3 lists, got %d", len(lists))
	}
	hasIsraeliMod := false
	for _, l := range lists {
		if l.ListID == "israeli_mod" {
			hasIsraeliMod = true
			if !containsString(l.SourceURL, "nbctf.mod.gov.il") {
				t.Errorf("Israeli MOD should have nbctf URL")
			}
		}
	}
	if !hasIsraeliMod {
		t.Errorf("Israel config missing israeli_mod list")
	}
}

func TestSuggestedListsUK(t *testing.T) {
	lists := SuggestedLists("GB")
	if len(lists) < 2 {
		t.Errorf("UK should have at least 2 lists, got %d", len(lists))
	}
	hasUKOFSI := false
	for _, l := range lists {
		if l.ListID == "uk_ofsi" {
			hasUKOFSI = true
		}
	}
	if !hasUKOFSI {
		t.Errorf("UK config missing uk_ofsi list")
	}
}

func TestSuggestedListsSwitzerland(t *testing.T) {
	lists := SuggestedLists("CH")
	if len(lists) < 2 {
		t.Errorf("Switzerland should have at least 2 lists")
	}
	hasSECO := false
	for _, l := range lists {
		if l.ListID == "seco" {
			hasSECO = true
		}
	}
	if !hasSECO {
		t.Errorf("Switzerland config missing seco list")
	}
}

func TestSuggestedListsDefault(t *testing.T) {
	lists := SuggestedLists("JP")
	if len(lists) == 0 {
		t.Errorf("Default should have lists")
	}
	hasOFAC := false
	for _, l := range lists {
		if l.ListID == "ofac-sdn" {
			hasOFAC = true
		}
	}
	if !hasOFAC {
		t.Errorf("Default config missing ofac-sdn list")
	}
}

func TestSuggestedListsValidation(t *testing.T) {
	countries := []string{"IL", "GB", "DE", "FR", "IT", "ES", "CH", "JP"}
	for _, country := range countries {
		lists := SuggestedLists(country)
		for _, l := range lists {
			if err := l.Validate(); err != nil {
				t.Errorf("Country %s list %s validation failed: %v", country, l.ListID, err)
			}
		}
	}
}

func containsString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
