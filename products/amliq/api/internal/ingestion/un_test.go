package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestUNParser(t *testing.T) {
	tests := []struct {
		name              string
		xml               string
		wantN             int
		wantType          domain.EntityType
		wantName          string
		wantDesignation   string
		wantDataset       string
	}{
		{name: "empty_xml", xml: `<CONSOLIDATED_LIST></CONSOLIDATED_LIST>`},
		{
			name: "individual_basic", xml: unIndividualXML,
			wantN: 1, wantType: domain.EntityTypeIndividual,
			wantName: "John Smith", wantDataset: "un_sc_sanctions",
		},
		{
			name: "entity_company", xml: unCompanyXML,
			wantN: 1, wantType: domain.EntityTypeCompany,
			wantName: "ACME Corporation", wantDataset: "un_sc_sanctions",
		},
		{name: "skip_single_word_individual", xml: unSingleWordXML},
		{
			name: "alias_with_designation", xml: unAliasXML,
			wantN: 1, wantName: "Ahmed Hassan",
			wantDesignation: "Terrorist",
		},
		{name: "both_individuals_and_entities", xml: unBothTypesXML, wantN: 2},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			parser := NewUNParser()
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
			if tc.wantDataset != "" {
				if v := entities[0].Metadata["dataset"]; v != tc.wantDataset {
					t.Errorf("dataset = %v, want %v", v, tc.wantDataset)
				}
			}
			if tc.wantDesignation != "" {
				if v := entities[0].Metadata["position"]; v != tc.wantDesignation {
					t.Errorf("position = %v, want %v", v, tc.wantDesignation)
				}
			}
		})
	}
}
