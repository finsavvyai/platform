package ingestion

import (
	"testing"
)

func TestOFACAdvancedParser(t *testing.T) {
	t.Skip("WIP parser — aliases and vessel parsing not complete")
	tests := []struct {
		name           string
		xml            string
		expectedCount  int
		expectAliases  int
		expectIdents   int
		expectDOB      bool
		expectPrograms bool
	}{
		{"person_with_passport", personPassportXML(), 1, 0, 1, true, true},
		{"person_with_aliases", personAliasesXML(), 1, 2, 0, false, false},
		{"vessel_entry", vesselXML(), 1, 0, 1, false, true},
		{"org_entry", orgXML(), 1, 0, 0, false, false},
		{"single_name_skipped", singleNameXML(), 0, 0, 0, false, false},
	}

	parser := NewOFACAdvancedParser()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ents, err := parser.Parse([]byte(tt.xml))
			if err != nil {
				t.Fatalf("Parse() error = %v", err)
			}
			if len(ents) != tt.expectedCount {
				t.Errorf("got %d entities, want %d", len(ents), tt.expectedCount)
			}
			if tt.expectedCount > 0 {
				ent := ents[0]
				if len(ent.Names)-1 != tt.expectAliases {
					t.Errorf("aliases = %d, want %d", len(ent.Names)-1, tt.expectAliases)
				}
				if len(ent.Identifiers) != tt.expectIdents {
					t.Errorf("identifiers = %d, want %d", len(ent.Identifiers), tt.expectIdents)
				}
				if tt.expectDOB && ent.DOB == nil {
					t.Errorf("DOB = nil, want non-nil")
				}
				if tt.expectPrograms {
					if prog, ok := ent.Metadata["programs"].(string); !ok || prog == "" {
						t.Errorf("programs not set")
					}
				}
			}
		})
	}
}
