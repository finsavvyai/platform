package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestClassifyUNDocType(t *testing.T) {
	tests := []struct {
		raw  string
		want domain.IdentifierType
	}{
		{"Passport", domain.IDPassport},
		{"PASSPORT NUMBER", domain.IDPassport},
		{"National Identification Number", domain.IDNationalID},
		{"Identity Card", domain.IDNationalID},
		{"Tax ID", domain.IDTaxID},
		{"Company Registration", domain.IDRegistration},
		{"IMO Number", domain.IDIMOID},
		{"", domain.IDPassport}, // default fallback
		{"Driver License", domain.IDPassport}, // default fallback
	}
	for _, tc := range tests {
		t.Run(tc.raw, func(t *testing.T) {
			got := classifyUNDocType(tc.raw)
			if got != tc.want {
				t.Errorf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestUnDocsToIdentifiers(t *testing.T) {
	docs := []unDocument{
		{TypeOfDoc: "Passport", Number: "A1234567", IssuingCountry: "US"},
		{TypeOfDoc: "National ID", Number: "999-88-7777", IssuingCountry: "IR"},
		{TypeOfDoc: "Passport", Number: "  ", IssuingCountry: "US"}, // skip blank
		{TypeOfDoc: "Unknown", Number: "ABC", IssuingCountry: ""},
	}
	got := unDocsToIdentifiers(docs)
	if len(got) != 3 {
		t.Fatalf("got %d ids, want 3", len(got))
	}
	if got[0].Type != domain.IDPassport || got[0].Value != "A1234567" || got[0].Country != "US" {
		t.Errorf("first id: %+v", got[0])
	}
	if got[1].Type != domain.IDNationalID || got[1].Value != "999-88-7777" {
		t.Errorf("second id: %+v", got[1])
	}
}
