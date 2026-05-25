package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestSDFMParser(t *testing.T) {
	tests := []struct {
		name       string
		xml        string
		wantN      int
		wantType   domain.EntityType
		wantName   string
		checkAlias bool
	}{
		{
			name:  "empty_xml",
			xml:   `<consolidated-list></consolidated-list>`,
			wantN: 0,
		},
		{
			name:     "individual_primary_name",
			xml:      sdfmIndividualXML,
			wantN:    1,
			wantType: domain.EntityTypeIndividual,
			wantName: "Ivan Petrov",
		},
		{
			name:     "company_type_1",
			xml:      sdfmCompanyXML,
			wantN:    1,
			wantType: domain.EntityTypeCompany,
		},
		{
			name:       "alias_fallback_to_primary",
			xml:        sdfmAliasXML,
			wantN:      1,
			wantName:   "Oleh Kovalenko",
			checkAlias: true,
		},
		{
			name:  "skip_single_word",
			xml:   sdfmSingleWordXML,
			wantN: 0,
		},
		{
			name:     "with_bom",
			xml:      "\xEF\xBB\xBF" + sdfmBOMXML,
			wantN:    1,
			wantName: "Test Person",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			parser := NewSDFMParser()
			entities, err := parser.Parse([]byte(tc.xml))
			if err != nil {
				t.Fatalf("Parse error: %v", err)
			}
			if len(entities) != tc.wantN {
				t.Fatalf("got %d entities, want %d",
					len(entities), tc.wantN)
			}
			if tc.wantN == 0 {
				return
			}
			if tc.wantType != 0 && entities[0].Type != tc.wantType {
				t.Errorf("type = %v, want %v",
					entities[0].Type, tc.wantType)
			}
			if tc.wantName != "" {
				got := entities[0].PrimaryName().String()
				if got != tc.wantName {
					t.Errorf("name = %q, want %q", got, tc.wantName)
				}
			}
			if tc.checkAlias {
				if _, ok := entities[0].Metadata["aliases"]; !ok {
					t.Errorf("aliases metadata not found")
				}
			}
		})
	}
}
