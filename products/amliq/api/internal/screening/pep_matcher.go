package screening

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PEPRepository reads PEP profiles.
type PEPRepository interface {
	GetByEntityID(ctx context.Context, entityID string) (*domain.PEPProfile, error)
}

// PEPMatcher enriches screening results with PEP-specific evidence.
type PEPMatcher struct {
	pepRepo    PEPRepository
	engine     *Engine
	decayYears int
}

func NewPEPMatcher(repo PEPRepository, engine *Engine) *PEPMatcher {
	return &PEPMatcher{pepRepo: repo, engine: engine, decayYears: 5}
}

// PEPResult combines screening match with PEP profile data.
type PEPResult struct {
	domain.MatchResult
	IsPEP    bool            `json:"is_pep"`
	Profile  *domain.PEPProfile `json:"profile,omitempty"`
	RiskWeight float64       `json:"risk_weight"`
}

// Screen runs the engine cascade then enriches with PEP data.
func (pm *PEPMatcher) Screen(
	ctx context.Context,
	tenantID domain.TenantID,
	query domain.Entity,
	pepCandidates []domain.Entity,
	matchCfg *domain.MatchConfig,
) ([]PEPResult, error) {
	results, err := pm.engine.ScreenWithContext(
		ctx, tenantID, query, pepCandidates, matchCfg,
	)
	if err != nil {
		return nil, err
	}
	return pm.enrichWithPEP(ctx, results), nil
}

func (pm *PEPMatcher) enrichWithPEP(
	ctx context.Context, results []domain.MatchResult,
) []PEPResult {
	var pepResults []PEPResult
	for _, r := range results {
		pr := PEPResult{MatchResult: r}
		profile, err := pm.pepRepo.GetByEntityID(ctx, r.EntityID.String())
		if err == nil && profile != nil {
			pr.IsPEP = true
			pr.Profile = profile
			pr.RiskWeight = pm.calcRiskWeight(profile)
		}
		pepResults = append(pepResults, pr)
	}
	return pepResults
}

func (pm *PEPMatcher) calcRiskWeight(p *domain.PEPProfile) float64 {
	weight := p.Tier.RiskWeight()
	if !p.IsActive && p.ActiveTo != "" {
		if end, err := time.Parse("2006-01-02", p.ActiveTo); err == nil {
			years := time.Since(end).Hours() / (24 * 365)
			if years > float64(pm.decayYears) {
				weight *= 0.3
			} else {
				decay := 1.0 - (years / float64(pm.decayYears) * 0.7)
				weight *= decay
			}
		}
	}
	return weight
}
