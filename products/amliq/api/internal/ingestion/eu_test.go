package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEUParser(t *testing.T) {
	tests := []struct {
		name        string
		rows        string
		wantN       int
		wantType    domain.EntityType
		wantName    string
		wantList    string
		checkMeta   string
		hasMetaKey  bool
	}{
		{name: "empty_csv", rows: "", wantN: 0},
		{
			name: "single_person", rows: euSinglePerson,
			wantN: 1, wantType: domain.EntityTypeIndividual,
			wantName: "John Smith", wantList: "eu-fsf",
		},
		{
			name: "company_no_P", rows: euCompany,
			wantN: 1, wantType: domain.EntityTypeCompany,
			wantName: "ACME Corp",
		},
		{
			name: "multi_row_aggregation", rows: euMultiRow,
			wantN: 1, wantName: "Jane Doe",
		},
		{
			name: "fallback_first_last", rows: euFallbackFirstLast,
			wantN: 1, wantName: "John Smith",
		},
		{
			name: "birth_date_parsed", rows: euSinglePerson,
			wantN: 1, checkMeta: "dob", hasMetaKey: true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			data := []byte(euTestHeader + tc.rows)
			parser := NewEUParser()
			entities, err := parser.Parse(data)
			if err != nil {
				t.Fatalf("Parse error: %v", err)
			}
			if len(entities) != tc.wantN {
				t.Fatalf("got %d, want %d", len(entities), tc.wantN)
			}
			if tc.wantN == 0 {
				return
			}
			ent := entities[0]
			if tc.wantType != 0 && ent.Type != tc.wantType {
				t.Errorf("type = %v, want %v", ent.Type, tc.wantType)
			}
			if tc.wantName != "" {
				got := ent.PrimaryName().String()
				if got != tc.wantName {
					t.Errorf("name = %q, want %q", got, tc.wantName)
				}
			}
			if tc.wantList != "" && ent.ListID != tc.wantList {
				t.Errorf("listID = %q, want %q", ent.ListID, tc.wantList)
			}
			if tc.checkMeta != "" && tc.hasMetaKey {
				if _, ok := ent.Metadata[tc.checkMeta]; !ok {
					t.Errorf("metadata key %q not found", tc.checkMeta)
				}
			}
		})
	}
}
