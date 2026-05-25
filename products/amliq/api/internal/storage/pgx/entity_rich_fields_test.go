package pgx

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestRichColsRoundTrip(t *testing.T) {
	tests := []struct {
		name   string
		build  func() domain.Entity
		assert func(t *testing.T, out domain.Entity)
	}{
		{
			name: "addresses survive",
			build: func() domain.Entity {
				n, _ := domain.NewName("Vladimir Putin", "Vladimir", "Putin", "")
				e, _ := domain.NewEntity(mustID("ent_1"),
					domain.EntityTypeIndividual, []domain.Name{n})
				e.Addresses = []string{"Moscow, RU", "Sochi, RU"}
				return e
			},
			assert: func(t *testing.T, out domain.Entity) {
				if len(out.Addresses) != 2 {
					t.Fatalf("addresses: got %d want 2", len(out.Addresses))
				}
			},
		},
		{
			name: "identifiers survive",
			build: func() domain.Entity {
				n, _ := domain.NewName("Kim", "Kim", "", "")
				e, _ := domain.NewEntity(mustID("ent_2"),
					domain.EntityTypeIndividual, []domain.Name{n})
				id, _ := domain.NewIdentifier(
					domain.IdentifierType("passport"), "P1234567", "KP")
				e.Identifiers = []domain.Identifier{id}
				return e
			},
			assert: func(t *testing.T, out domain.Entity) {
				if len(out.Identifiers) != 1 {
					t.Fatalf("identifiers: got %d want 1", len(out.Identifiers))
				}
				if out.Identifiers[0].Value != "P1234567" {
					t.Fatalf("identifier value: got %q", out.Identifiers[0].Value)
				}
			},
		},
		{
			name: "aliases survive",
			build: func() domain.Entity {
				p, _ := domain.NewName("Jose Perez", "Jose", "Perez", "")
				a, _ := domain.NewName("Jose P Garcia", "", "", "")
				e, _ := domain.NewEntity(mustID("ent_3"),
					domain.EntityTypeIndividual, []domain.Name{p, a})
				return e
			},
			assert: func(t *testing.T, out domain.Entity) {
				if len(out.Names) < 2 || out.Names[1].Full != "Jose P Garcia" {
					t.Fatalf("aliases lost: names=%+v", out.Names)
				}
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			in := tc.build()
			addrs, ids, aliases := marshalRichCols(in)
			p, _ := domain.NewName(in.Names[0].Full, "", "", "")
			out, _ := domain.NewEntity(in.ID,
				domain.EntityTypeIndividual, []domain.Name{p})
			applyRichCols(&out, addrs, ids, aliases)
			tc.assert(t, out)
		})
	}
}

func mustID(s string) domain.EntityID {
	id, _ := domain.NewEntityID(s)
	return id
}
