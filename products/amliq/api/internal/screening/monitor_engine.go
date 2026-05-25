package screening

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PreviousMatch stores a prior match for delta comparison.
type PreviousMatch struct {
	EntityID string
	Score    float64
}

// MonitorEngine performs ongoing monitoring re-screening.
type MonitorEngine struct {
	engine *Engine
}

// NewMonitorEngine wraps the screening engine for monitoring.
func NewMonitorEngine(engine *Engine) *MonitorEngine {
	return &MonitorEngine{engine: engine}
}

// ScreenProfile screens a profile against candidate entities.
func (me *MonitorEngine) ScreenProfile(
	ctx context.Context,
	profile domain.MonitorProfile,
	candidates []domain.Entity,
	previous []PreviousMatch,
) ([]domain.MonitorAlert, error) {
	name, err := domain.NewName(profile.EntityName, "", "", "")
	if err != nil {
		return nil, fmt.Errorf("invalid profile name: %w", err)
	}
	query := domain.Entity{Type: profile.EntityType, Names: []domain.Name{name}}
	results, err := me.engine.Screen(query, candidates)
	if err != nil {
		return nil, fmt.Errorf("screen error: %w", err)
	}
	return compareResults(profile, results, previous), nil
}

func compareResults(
	p domain.MonitorProfile, current []domain.MatchResult, previous []PreviousMatch,
) []domain.MonitorAlert {
	prevMap := make(map[string]float64, len(previous))
	for _, pm := range previous {
		prevMap[pm.EntityID] = pm.Score
	}
	var alerts []domain.MonitorAlert
	for _, res := range current {
		eid := res.EntityID.String()
		prev, existed := prevMap[eid]
		if !existed {
			alerts = append(alerts, makeMonitorAlert(p, domain.AlertNewMatch, res.Confidence.Score(), eid))
		} else if absDiff(prev, res.Confidence.Score()) > 0.05 {
			a := makeMonitorAlert(p, domain.AlertScoreChange, res.Confidence.Score(), eid)
			a.PreviousScore = prev
			alerts = append(alerts, a)
		}
		delete(prevMap, eid)
	}
	for eid := range prevMap {
		alerts = append(alerts, makeMonitorAlert(p, domain.AlertMatchRemoved, 0, eid))
	}
	return alerts
}

func makeMonitorAlert(
	p domain.MonitorProfile, at domain.MonitorAlertType, score float64, entity string,
) domain.MonitorAlert {
	a, _ := domain.NewMonitorAlert(p.ID, p.TenantID, at, domain.SeverityFromScore(score))
	a.MatchScore = score
	a.MatchedEntity = entity
	return a
}

func absDiff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}
