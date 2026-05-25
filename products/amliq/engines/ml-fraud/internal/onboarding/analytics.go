package onboarding

import "context"

// GetAnalytics computes aggregated onboarding metrics from all stored sessions.
func (r *InMemoryOnboardingRepository) GetAnalytics(
	_ context.Context,
) (*OnboardingAnalytics, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	analytics := &OnboardingAnalytics{
		DropOffByStep: make(map[OnboardingStep]int),
	}

	var totalCompletionMinutes float64
	for _, s := range r.sessions {
		analytics.TotalSessions++

		switch s.Status {
		case StatusCompleted:
			analytics.CompletedSessions++
			if s.CompletedAt != nil {
				dur := s.CompletedAt.Sub(s.CreatedAt).Minutes()
				totalCompletionMinutes += dur
			}
		case StatusAbandoned:
			analytics.AbandonedSessions++
			analytics.DropOffByStep[s.CurrentStep]++
		}
	}

	if analytics.CompletedSessions > 0 {
		analytics.AvgCompletionMinutes = totalCompletionMinutes /
			float64(analytics.CompletedSessions)
	}

	return analytics, nil
}
