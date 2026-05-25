package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestOpenSanctionsParser(t *testing.T) {
	tests := []struct {
		name      string
		csv       string
		wantCount int
		wantType  domain.EntityType
		wantName  string
	}{
		{
			name:      "standard_person",
			csv:       "id,name,schema\nq1234567890abc,John Smith,Person\n",
			wantCount: 1,
			wantType:  domain.EntityTypeIndividual,
			wantName:  "John Smith",
		},
		{
			name:      "company_schema",
			csv:       "id,name,schema\nq1234567890abc,ACME Corp,Organization\n",
			wantCount: 1,
			wantType:  domain.EntityTypeCompany,
		},
		{
			name:      "skip_single_word_individual",
			csv:       "id,name,schema\nq1234567890abc,Madonna,Person\n",
			wantCount: 0,
		},
		{
			name:      "fallback_first_last",
			csv:       "id,name,given_name,surname,schema\nq1234567890abc,,John,Smith,Person\n",
			wantCount: 1,
			wantName:  "John Smith",
		},
		{
			name:      "extended_fields",
			csv:       "id,name,schema,phones,emails,dataset\nq1234567890abc,John Smith,Person,+1234,j@e.com,ofac\n",
			wantCount: 1,
		},
		{
			name:      "empty_csv",
			csv:       "id,name,schema\n",
			wantCount: 0,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			parser := NewOpenSanctionsParser()
			entities, err := parser.Parse([]byte(tc.csv))
			if err != nil {
				t.Fatalf("Parse error: %v", err)
			}
			if len(entities) != tc.wantCount {
				t.Errorf("got %d entities, want %d",
					len(entities), tc.wantCount)
			}
			if tc.wantCount > 0 && tc.wantType != 0 {
				if entities[0].Type != tc.wantType {
					t.Errorf("type = %v, want %v",
						entities[0].Type, tc.wantType)
				}
			}
			if tc.wantCount > 0 && tc.wantName != "" {
				got := entities[0].PrimaryName().String()
				if got != tc.wantName {
					t.Errorf("name = %q, want %q",
						got, tc.wantName)
				}
			}
		})
	}
}

func TestOpenSanctionsAliasParser(t *testing.T) {
	csv := "id,name,aliases,schema\nq1234567890abc,John Smith,Johann Schmidt,Person\n"
	parser := NewOpenSanctionsAliasParser()
	entities, err := parser.Parse([]byte(csv))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(entities) != 1 {
		t.Fatalf("got %d entities, want 1", len(entities))
	}
	got := entities[0].PrimaryName().String()
	if got != "Johann Schmidt" {
		t.Errorf("alias name = %q, want %q", got, "Johann Schmidt")
	}
}
