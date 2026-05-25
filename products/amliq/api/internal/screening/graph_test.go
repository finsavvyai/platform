package screening

import (
	"context"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockRelationshipFinder struct {
	rels map[string][]domain.Relationship
}

func (m *mockRelationshipFinder) FindByEntityWithDepth(
	_ context.Context, entityID string, _ int,
) ([]domain.Relationship, error) {
	return m.rels[entityID], nil
}

func TestGraphMatcherMatchEntities(t *testing.T) {
	rel1, _ := domain.NewRelationship("ent_111", "ent_222", domain.RelAssociate, 0.9, "ofac")
	rel2, _ := domain.NewRelationship("ent_111", "ent_333", domain.RelFamily, 0.8, "un")

	finder := &mockRelationshipFinder{
		rels: map[string][]domain.Relationship{
			"ent_111": {rel1, rel2},
		},
	}
	gm := NewGraphMatcher(finder)

	sanctioned := map[string]bool{"ent_222": true, "ent_999": true}

	tests := []struct {
		name          string
		candidateIDs  []string
		expectedCount int
	}{
		{"match_sanctioned_relation", []string{"ent_111"}, 1},
		{"no_relations", []string{"ent_555"}, 0},
		{"multiple_candidates", []string{"ent_111", "ent_555"}, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := gm.MatchEntities(context.Background(), tt.candidateIDs, sanctioned)
			if len(got) != tt.expectedCount {
				t.Errorf("got %d results, want %d", len(got), tt.expectedCount)
			}
		})
	}
}

func TestGraphScoreForRelation(t *testing.T) {
	alias, _ := domain.NewRelationship("a", "b", domain.RelAlias, 1.0, "ofac")
	assoc, _ := domain.NewRelationship("a", "b", domain.RelAssociate, 1.0, "ofac")

	if s := graphScoreForRelation(alias); s != 0.9 {
		t.Errorf("alias score = %v, want 0.9", s)
	}
	if s := graphScoreForRelation(assoc); s != 0.6 {
		t.Errorf("associate score = %v, want 0.6", s)
	}
}
