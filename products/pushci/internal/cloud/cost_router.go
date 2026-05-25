package cloud

import "time"

// CostProfile holds pricing info for a runner type.
type CostProfile struct {
	Provider   string
	CostPerMin float64
	LatencyMs  int
	Labels     []string
	Capability int // 1=basic, 2=standard, 3=gpu
}

// DefaultCostProfiles returns known pricing for cloud providers.
func DefaultCostProfiles() []CostProfile {
	return []CostProfile{
		{Provider: "local", CostPerMin: 0, LatencyMs: 0, Labels: []string{"local", "self-hosted"}, Capability: 2},
		{Provider: "hetzner", CostPerMin: 0.007, LatencyMs: 50, Labels: []string{"cloud", "hetzner"}, Capability: 2},
		{Provider: "fly", CostPerMin: 0.012, LatencyMs: 30, Labels: []string{"cloud", "fly"}, Capability: 2},
		{Provider: "aws-spot", CostPerMin: 0.004, LatencyMs: 80, Labels: []string{"cloud", "aws", "spot"}, Capability: 3},
		{Provider: "edge", CostPerMin: 0, LatencyMs: 5, Labels: []string{"edge"}, Capability: 1},
	}
}

// CostScore calculates a routing score (lower is better).
func CostScore(profile CostProfile, job *Job) float64 {
	est := EstimateDuration(job)
	minutes := est.Minutes()
	if minutes < 0.5 {
		minutes = 0.5
	}
	cost := profile.CostPerMin * minutes
	latency := float64(profile.LatencyMs) / 1000.0
	score := cost + latency*0.5
	if !labelsOverlap(profile.Labels, job.Labels) {
		score += 100
	}
	return score
}

// BestRoute picks the cheapest/fastest provider for a job.
func BestRoute(profiles []CostProfile, job *Job) *CostProfile {
	var best *CostProfile
	bestScore := 999.0
	for i := range profiles {
		p := &profiles[i]
		score := CostScore(*p, job)
		if score < bestScore {
			bestScore = score
			best = p
		}
	}
	return best
}

func labelsOverlap(a, b []string) bool {
	if len(b) == 0 {
		return true
	}
	set := make(map[string]bool, len(a))
	for _, l := range a {
		set[l] = true
	}
	for _, l := range b {
		if set[l] {
			return true
		}
	}
	return false
}

// EstimateCostSavings calculates savings vs GitHub Actions.
func EstimateCostSavings(job *Job) float64 {
	est := EstimateDuration(job)
	if est < time.Second {
		est = 30 * time.Second
	}
	ghaRate := 0.008 // GitHub Actions $0.008/min
	return ghaRate * est.Minutes()
}
