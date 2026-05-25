package ingestion

import (
	"strings"
	"testing"
)

// TestPEPParse_EnrichesEntity verifies the simple.csv parser populates
// DOB, nationalities, metadata, and uses the person's caption as the
// entity name.
func TestPEPParse_EnrichesEntity(t *testing.T) {
	csvData := strings.Join([]string{
		"id,schema,name,birth_date,countries,dataset,first_seen,last_seen,last_change,properties",
		`NK-benjamin-tan,Person,Benjamin Tan,1970-05-10,sg;my,peps,2024-01-01,2026-01-01,2026-01-02,"{""gender"":[""male""],""position"":[""Deputy Minister""],""topics"":[""role.pep""]}"`,
	}, "\n")

	p := NewOpenSanctionsPEPParser()
	ents, err := p.Parse([]byte(csvData))
	if err != nil {
		t.Fatalf("Parse error: %v", err)
	}
	if len(ents) != 1 {
		t.Fatalf("got %d entities, want 1", len(ents))
	}
	ent := ents[0]

	tests := []struct {
		name string
		got  string
		want string
	}{
		{"name_uses_caption", ent.PrimaryName().Full, "Benjamin Tan"},
		{"dataset", ent.Metadata["dataset"].(string), "peps"},
		{"schema_type", ent.Metadata["schemaType"].(string), "Person"},
		{"dob_meta", ent.Metadata["dob"].(string), "1970-05-10"},
		{"gender", ent.Metadata["gender"].(string), "male"},
		{"position", ent.Metadata["position"].(string), "Deputy Minister"},
		{"first_seen", ent.Metadata["first_seen"].(string), "2024-01-01"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("got=%q want=%q", tt.got, tt.want)
			}
		})
	}

	if ent.DOB == nil {
		t.Errorf("DOB not parsed from birth_date")
	}
	if len(ent.Nationalities) != 2 {
		t.Errorf("nationalities=%v want 2", ent.Nationalities)
	}
	if ent.ListID != "opensanctions_peps" {
		t.Errorf("ListID=%q want opensanctions_peps", ent.ListID)
	}
}
