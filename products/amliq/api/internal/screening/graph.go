package screening

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// RelationshipFinder retrieves entity relationships.
type RelationshipFinder interface {
	FindByEntityWithDepth(
		ctx context.Context, entityID string, maxDepth int,
	) ([]domain.Relationship, error)
}

// GraphMatcher detects sanctioned networks via relationship traversal.
type GraphMatcher struct {
	finder   RelationshipFinder
	maxDepth int
}

func NewGraphMatcher(finder RelationshipFinder) *GraphMatcher {
	return &GraphMatcher{finder: finder, maxDepth: 2}
}

// Match is a no-context fallback; returns empty for graph layer.
func (gm *GraphMatcher) Match(
	query domain.Name, candidates []domain.Name,
) []domain.MatchEvidence {
	return nil
}

// MatchEntities checks if candidates have sanctioned relationships.
func (gm *GraphMatcher) MatchEntities(
	ctx context.Context,
	candidateIDs []string,
	sanctionedIDs map[string]bool,
) []domain.MatchEvidence {
	var evidence []domain.MatchEvidence
	for _, candID := range candidateIDs {
		ev := gm.checkRelations(ctx, candID, sanctionedIDs)
		evidence = append(evidence, ev...)
	}
	return evidence
}

func (gm *GraphMatcher) checkRelations(
	ctx context.Context, entityID string, sanctionedIDs map[string]bool,
) []domain.MatchEvidence {
	rels, err := gm.finder.FindByEntityWithDepth(ctx, entityID, gm.maxDepth)
	if err != nil || len(rels) == 0 {
		return nil
	}
	var evidence []domain.MatchEvidence
	for _, rel := range rels {
		if !sanctionedIDs[rel.TargetEntityID] {
			continue
		}
		score := graphScoreForRelation(rel)
		ev := domain.NewMatchEvidence(
			domain.MatchLayerGraph, "graph_relation", score, 0.4,
			entityID, rel.TargetEntityID,
			formatRelationExplanation(rel),
		)
		evidence = append(evidence, ev)
	}
	return evidence
}

func graphScoreForRelation(rel domain.Relationship) float64 {
	base := 0.6
	if rel.RelationshipType == domain.RelAlias {
		base = 0.9
	}
	return base * rel.Confidence
}

func formatRelationExplanation(rel domain.Relationship) string {
	return fmt.Sprintf("Related to %s via %s (confidence: %.0f%%)",
		rel.TargetEntityID, rel.RelationshipType, rel.Confidence*100)
}
