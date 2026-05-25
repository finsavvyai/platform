package pgx

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestDedupeByID(t *testing.T) {
	mkEnt := func(id, listID string) domain.Entity {
		eid, _ := domain.NewEntityID(id)
		n, _ := domain.NewName("X", "", "", "")
		e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
		e.ListID = listID
		return e
	}

	tests := []struct {
		name string
		in   []domain.Entity
		want []string // resulting IDs, in order
		note string
	}{
		{
			name: "empty",
			in:   nil,
			want: nil,
		},
		{
			name: "single",
			in:   []domain.Entity{mkEnt("ent_a1", "un")},
			want: []string{"ent_a1"},
		},
		{
			name: "no duplicates",
			in: []domain.Entity{
				mkEnt("ent_a1", "un"),
				mkEnt("ent_b2", "un"),
				mkEnt("ent_c3", "un"),
			},
			want: []string{"ent_a1", "ent_b2", "ent_c3"},
		},
		{
			name: "one duplicate \u2014 keep LAST occurrence (fresher)",
			in: []domain.Entity{
				mkEnt("ent_a1", "un"),
				mkEnt("ent_b2", "un"),
				mkEnt("ent_a1", "ofac"), // second a1 has different list
				mkEnt("ent_c3", "un"),
			},
			want: []string{"ent_b2", "ent_a1", "ent_c3"},
			note: "first ent_a1 dropped; second kept, preserving its ofac list_id",
		},
		{
			name: "all duplicates collapse to one",
			in: []domain.Entity{
				mkEnt("ent_x", "un"),
				mkEnt("ent_x", "un"),
				mkEnt("ent_x", "un"),
			},
			want: []string{"ent_x"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := dedupeByID(tt.in)
			gotIDs := make([]string, len(got))
			for i, e := range got {
				gotIDs[i] = e.ID.String()
			}
			if len(gotIDs) != len(tt.want) {
				t.Fatalf("len = %d, want %d (got=%v)", len(gotIDs), len(tt.want), gotIDs)
			}
			for i, id := range tt.want {
				if gotIDs[i] != id {
					t.Errorf("pos %d: got %q, want %q", i, gotIDs[i], id)
				}
			}
		})
	}
}

// Regression: when the "kept" entry of a duplicate has different list_id
// than the dropped one, the kept entry's fields must survive intact.
// This is the israeli_treasury case that crashed reingest \u2014 same id
// appearing twice with slightly different metadata.
func TestDedupeByIDPreservesLastFields(t *testing.T) {
	a, _ := domain.NewEntityID("ent_same")
	n, _ := domain.NewName("X", "", "", "")
	e1, _ := domain.NewEntity(a, domain.EntityTypeIndividual, []domain.Name{n})
	e1.ListID = "old"
	e2, _ := domain.NewEntity(a, domain.EntityTypeIndividual, []domain.Name{n})
	e2.ListID = "new"
	out := dedupeByID([]domain.Entity{e1, e2})
	if len(out) != 1 {
		t.Fatalf("expected 1 entity, got %d", len(out))
	}
	if out[0].ListID != "new" {
		t.Errorf("ListID = %q, want %q", out[0].ListID, "new")
	}
}
