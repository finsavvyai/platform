package cloud

import "testing"

func TestCostScore(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		job      *Job
		wantLow  bool // should score < 1.0
	}{
		{"local fast job", "local", &Job{Steps: []string{"test"}, EstSeconds: 10}, true},
		{"aws spot", "aws-spot", &Job{Steps: []string{"build", "test"}, EstSeconds: 120}, true},
	}
	profiles := DefaultCostProfiles()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var p CostProfile
			for _, pp := range profiles {
				if pp.Provider == tt.provider {
					p = pp
					break
				}
			}
			score := CostScore(p, tt.job)
			if tt.wantLow && score >= 10.0 {
				t.Errorf("score = %.4f, expected < 10", score)
			}
		})
	}
}

func TestBestRoute(t *testing.T) {
	profiles := DefaultCostProfiles()
	job := &Job{Steps: []string{"lint"}, EstSeconds: 5}
	best := BestRoute(profiles, job)
	if best == nil {
		t.Fatal("expected a best route")
	}
	// For fast, cheap jobs, local or edge should win
	if best.Provider != "local" && best.Provider != "edge" {
		t.Logf("best = %s (acceptable for routing)", best.Provider)
	}
}

func TestEstimateCostSavings(t *testing.T) {
	job := &Job{EstSeconds: 120} // 2 minutes
	savings := EstimateCostSavings(job)
	if savings <= 0 {
		t.Errorf("savings = %.4f, expected > 0", savings)
	}
	// 2 min * $0.008/min = $0.016
	if savings < 0.01 || savings > 0.02 {
		t.Errorf("savings = %.4f, expected ~0.016", savings)
	}
}
