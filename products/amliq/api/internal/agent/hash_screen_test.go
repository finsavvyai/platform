package agent

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestHashScreener(t *testing.T) {
	entity := makeTestEntity(t, "ent_aaaaaaaaaaaa", "Osama Bin Laden", "ofac")

	tests := []struct {
		name       string
		hashInput  string
		useExact   bool
		wantMatch  bool
		wantConf   float64
	}{
		{
			name:      "exact hash match",
			hashInput: normalizeName("Osama Bin Laden"),
			useExact:  true,
			wantMatch: true,
			wantConf:  1.0,
		},
		{
			name:      "phonetic hash match",
			hashInput: simpleSoundex(normalizeName("Osama Bin Laden")),
			useExact:  false,
			wantMatch: true,
			wantConf:  0.7,
		},
		{
			name:      "no match returns empty",
			hashInput: normalizeName("No Such Person"),
			useExact:  true,
			wantMatch: false,
		},
	}

	idx := BuildHashIndex([]domain.Entity{entity})
	screener := NewHashScreener()
	screener.SetIndex(idx)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var hashed string
			if tt.useExact {
				hashed = hashSHA256(tt.hashInput)
			} else {
				hashed = hashSHA256(tt.hashInput)
			}
			results, err := screener.ScreenHashed([]string{hashed})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			hasMatch := len(results) > 0
			if hasMatch != tt.wantMatch {
				t.Errorf("match = %v, want %v", hasMatch, tt.wantMatch)
			}
			if tt.wantMatch && len(results) > 0 {
				if results[0].Confidence != tt.wantConf {
					t.Errorf("confidence = %v, want %v", results[0].Confidence, tt.wantConf)
				}
			}
		})
	}
}

func makeTestEntity(t *testing.T, id, name, listID string) domain.Entity {
	t.Helper()
	eid, err := domain.NewEntityID(id)
	if err != nil {
		t.Fatalf("entity ID: %v", err)
	}
	n, err := domain.NewName(name, "", "", "")
	if err != nil {
		t.Fatalf("name: %v", err)
	}
	e, err := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
	if err != nil {
		t.Fatalf("entity: %v", err)
	}
	e.ListID = listID
	return e
}
