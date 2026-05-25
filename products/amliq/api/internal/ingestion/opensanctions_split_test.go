package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestSplitSemi(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"empty", "", 0},
		{"single", "US", 1},
		{"multi", "US; GB; IL", 3},
		{"trailing_semi", "US; GB;", 2},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := splitSemi(tc.input)
			if len(got) != tc.want {
				t.Errorf("splitSemi(%q) len = %d, want %d",
					tc.input, len(got), tc.want)
			}
		})
	}
}

func TestSplitSemiToAliases(t *testing.T) {
	ent := &domain.Entity{
		Metadata: make(map[string]interface{}),
	}
	splitSemiToAliases(ent, "John Smith; Jean Dupont; 田中太郎")
	if len(ent.Names) != 3 {
		t.Fatalf("names count = %d, want 3", len(ent.Names))
	}
	if ent.Names[0].Full != "John Smith" {
		t.Errorf("alias[0] = %q, want John Smith", ent.Names[0].Full)
	}
}

func TestSplitSemiToNationalities(t *testing.T) {
	ent := &domain.Entity{
		Metadata: make(map[string]interface{}),
	}
	splitSemiToNationalities(ent, "US; GB; IL")
	if len(ent.Nationalities) != 3 {
		t.Fatalf("nationalities = %d, want 3", len(ent.Nationalities))
	}
}

func TestSplitSemiToIdentifiers(t *testing.T) {
	ent := &domain.Entity{
		Metadata:    make(map[string]interface{}),
		Identifiers: []domain.Identifier{},
	}
	splitSemiToIdentifiers(ent, "AB123456; CD789012")
	if len(ent.Identifiers) != 2 {
		t.Fatalf("identifiers = %d, want 2", len(ent.Identifiers))
	}
}
