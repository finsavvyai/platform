package ingestion

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeEntity(idSuffix, fullName, listID string, dob *time.Time, nats []string) domain.Entity {
	id, _ := domain.NewEntityID("ent_" + idSuffix)
	name, _ := domain.NewName(fullName, "", "", "")
	ent, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
	ent.ListID = listID
	ent.DOB = dob
	ent.Nationalities = nats
	return ent
}

func TestDeduplication(t *testing.T) {
	dob := time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
	dob2 := time.Date(1975, 6, 15, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name       string
		target     domain.Entity
		existing   []domain.Entity
		wantDupes  int
		wantNoDupe bool
	}{
		{
			name:   "same_name_different_lists_detected",
			target: makeEntity("aaaaaaaaaaaa", "John Smith", "ofac", &dob, []string{"US"}),
			existing: []domain.Entity{
				makeEntity("bbbbbbbbbbbb", "John Smith", "un", &dob, []string{"US"}),
				makeEntity("cccccccccccc", "Jane Doe", "eu", nil, nil),
			},
			wantDupes: 1,
		},
		{
			name:   "same_name_different_dob_not_merged",
			target: makeEntity("aaaaaaaaaaaa", "John Smith", "ofac", &dob, []string{"US"}),
			existing: []domain.Entity{
				makeEntity("bbbbbbbbbbbb", "John Smith", "un", &dob2, []string{"UK"}),
			},
			wantDupes:  0,
			wantNoDupe: true,
		},
		{
			name:   "different_name_not_matched",
			target: makeEntity("aaaaaaaaaaaa", "John Smith", "ofac", &dob, nil),
			existing: []domain.Entity{
				makeEntity("bbbbbbbbbbbb", "Alice Johnson", "un", &dob, nil),
			},
			wantDupes:  0,
			wantNoDupe: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dd := NewDeduplicator(tt.existing)
			dupes := dd.FindDuplicates(tt.target)

			if tt.wantNoDupe && len(dupes) > 0 {
				t.Errorf("expected no duplicates, got %d", len(dupes))
				return
			}
			if !tt.wantNoDupe && len(dupes) != tt.wantDupes {
				t.Errorf("dupes=%d, want=%d", len(dupes), tt.wantDupes)
			}
		})
	}
}

func TestMergeDuplicates(t *testing.T) {
	dob := time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
	primary := makeEntity("aaaaaaaaaaaa", "John Smith", "ofac", nil, []string{"US"})
	dupe := makeEntity("bbbbbbbbbbbb", "John Smith", "un", &dob, []string{"UK"})
	dupe.Metadata["source"] = "un"

	merged := MergeDuplicates(primary, []domain.Entity{dupe})

	if merged.DOB == nil {
		t.Error("expected DOB to be merged from duplicate")
	}
	if len(merged.Nationalities) != 2 {
		t.Errorf("nationalities=%d, want=2", len(merged.Nationalities))
	}
	if _, ok := merged.Metadata["source"]; !ok {
		t.Error("expected metadata to be merged")
	}
}
