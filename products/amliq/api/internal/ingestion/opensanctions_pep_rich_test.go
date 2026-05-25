package ingestion

import (
	"strings"
	"testing"
)

// TestPEPParse_RichFields verifies that a simple.csv row with
// addresses/identifiers/aliases populates Entity.Addresses,
// Entity.Identifiers, and Entity.Names[1:] so they round-trip through
// the storage layer.
func TestPEPParse_RichFields(t *testing.T) {
	csv := strings.Join([]string{
		"id,schema,name,aliases,birth_date,countries,addresses,identifiers,dataset",
		`NK-x,Person,Kim Jong Un,Kim Jong-un;Kim III,1984-01-08,kp,"Pyongyang, KP;Wonsan, KP","P123;P456",peps`,
	}, "\n")

	ents, err := NewOpenSanctionsPEPParser().Parse([]byte(csv))
	if err != nil || len(ents) != 1 {
		t.Fatalf("Parse err=%v n=%d", err, len(ents))
	}
	e := ents[0]

	tests := []struct {
		name string
		got  int
		want int
	}{
		{"addresses", len(e.Addresses), 2},
		{"identifiers", len(e.Identifiers), 2},
		{"aliases_as_names", len(e.Names), 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("%s: got %d want %d", tt.name, tt.got, tt.want)
			}
		})
	}

	if e.Identifiers[0].Value != "P123" {
		t.Errorf("identifier[0].Value=%q", e.Identifiers[0].Value)
	}
	if e.Names[1].Full != "Kim Jong-un" {
		t.Errorf("alias[0]=%q", e.Names[1].Full)
	}
}
