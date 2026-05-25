package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestOpenSanctionsBulkParser(t *testing.T) {
	hdr := "id,caption,schema,properties,datasets"
	hdrFull := hdr + ",first_seen,last_seen,last_change"
	tests := []struct {
		name     string
		csv      string
		wantN    int
		wantType domain.EntityType
		wantList string
	}{
		{"person_entity", hdrFull + "\nQ123,John Smith,Person,\"{\"\"name\"\":[\"\"John Smith\"\"]}\",us_ofac_sdn,2020-01-01,2024-01-01,2024-01-01\n", 1, domain.EntityTypeIndividual, "us_ofac_sdn"},
		{"org_to_company", hdr + "\nQ456,ACME Corp,Organization,\"{}\",eu_fsf\n", 1, domain.EntityTypeCompany, "eu_fsf"},
		{"company_schema", hdr + "\nQ789,Shell Co,Company,\"{}\",un_sc_sanctions\n", 1, domain.EntityTypeCompany, "un_sc_sanctions"},
		{"legal_entity", hdr + "\nQ012,Legal Ltd,LegalEntity,\"{}\",uk_ofsi\n", 1, domain.EntityTypeCompany, "uk_ofsi"},
		{"properties", hdr + "\nQ345,Jane Doe,Person,\"{\"\"birthDate\"\":[\"\"1980-05-15\"\"],\"\"nationality\"\":[\"\"US\"\"]}\",other\n", 1, 0, ""},
		{"default_list", hdr + "\nQ678,Test Person,Person,\"{}\",some_unknown\n", 1, 0, ""},
		{"empty_csv", hdr + "\n", 0, 0, ""},
		{"skip_empty_caption", hdr + "\nQ999,,Person,\"{}\",ofac\n", 0, 0, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p := NewOpenSanctionsBulkParser()
			ents, err := p.Parse([]byte(tc.csv))
			if err != nil {
				t.Fatalf("Parse error: %v", err)
			}
			if len(ents) != tc.wantN {
				t.Errorf("got %d entities, want %d", len(ents), tc.wantN)
			}
			if tc.wantN > 0 && tc.wantType != 0 {
				if ents[0].Type != tc.wantType {
					t.Errorf("type = %v, want %v", ents[0].Type, tc.wantType)
				}
			}
			if tc.wantN > 0 && tc.wantList != "" {
				if ents[0].ListID != tc.wantList {
					t.Errorf("listID = %q, want %q", ents[0].ListID, tc.wantList)
				}
			}
		})
	}
}

func TestMapSchemaType(t *testing.T) {
	tests := []struct {
		schema string
		want   domain.EntityType
	}{
		{"Person", domain.EntityTypeIndividual},
		{"Organization", domain.EntityTypeCompany},
		{"Company", domain.EntityTypeCompany},
		{"LegalEntity", domain.EntityTypeCompany},
		{"Unknown", domain.EntityTypeUnknown},
	}
	for _, tc := range tests {
		if got := mapSchemaType(tc.schema); got != tc.want {
			t.Errorf("mapSchemaType(%q) = %v, want %v", tc.schema, got, tc.want)
		}
	}
}
