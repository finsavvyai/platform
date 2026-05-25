package screening

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EnforcementStore retrieves enforcement actions for screening.
type EnforcementStore interface {
	SearchByName(ctx context.Context, name string, limit int) ([]domain.EnforcementAction, error)
}

// EnforcementChecker adds enforcement evidence to screening results.
type EnforcementChecker struct {
	store EnforcementStore
}

func NewEnforcementChecker(store EnforcementStore) *EnforcementChecker {
	return &EnforcementChecker{store: store}
}

// Check searches enforcement DB for matches and returns evidence.
func (ec *EnforcementChecker) Check(
	ctx context.Context, entityName string,
) []domain.MatchEvidence {
	actions, err := ec.store.SearchByName(ctx, entityName, 10)
	if err != nil || len(actions) == 0 {
		return nil
	}
	var evidence []domain.MatchEvidence
	for _, action := range actions {
		score := enforcementScore(action)
		ev := domain.NewMatchEvidence(
			domain.MatchLayerGraph, // reuse graph layer for supplementary data
			"enforcement_"+string(action.ActionType),
			score,
			0.3, // lower weight — enforcement boosts but doesn't block alone
			entityName,
			action.EntityName,
			enforcementExplanation(action),
		)
		evidence = append(evidence, ev)
	}
	return evidence
}

func enforcementScore(a domain.EnforcementAction) float64 {
	switch a.ActionType {
	case domain.ActionBan, domain.ActionLicenseRevocation:
		return 0.9
	case domain.ActionFine:
		return 0.7
	case domain.ActionCeaseDesist:
		return 0.6
	default:
		return 0.4
	}
}

func enforcementExplanation(a domain.EnforcementAction) string {
	return a.Regulator + " " + string(a.ActionType) + ": " + a.Description
}
