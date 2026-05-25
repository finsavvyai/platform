package screening

import "github.com/aegis-aml/aegis/internal/domain"

type PostProcessResult struct {
	Escalated []domain.MatchResult
	Review    []domain.MatchResult
	Dismissed []domain.MatchResult
}

func PostProcess(
	results []domain.MatchResult,
	config domain.TenantConfig,
) PostProcessResult {
	var escalated, review, dismissed []domain.MatchResult

	for _, result := range results {
		score := result.Confidence.Score()

		if score >= config.AutoEscalateAbove {
			escalated = append(escalated, result)
		} else if score <= config.AutoDismissBelow {
			dismissed = append(dismissed, result)
		} else {
			review = append(review, result)
		}
	}

	return PostProcessResult{
		Escalated: escalated,
		Review:    review,
		Dismissed: dismissed,
	}
}
