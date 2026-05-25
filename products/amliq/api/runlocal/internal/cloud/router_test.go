package cloud

import "testing"

func TestRouteDecisions(t *testing.T) {
	tests := []struct {
		name       string
		jobLabels  []string
		estSeconds int
		poolLabels [][]string // labels for each runner in pool
		wantReason string
	}{
		{
			name:       "gpu job routes to gpu runner",
			jobLabels:  []string{"gpu"},
			poolLabels: [][]string{{"gpu"}, {"cloud"}},
			wantReason: "gpu (label match)",
		},
		{
			name:       "macos job routes to macos runner",
			jobLabels:  []string{"macos"},
			poolLabels: [][]string{{"local"}, {"macos"}},
			wantReason: "macos (label match)",
		},
		{
			name:       "fast job prefers local",
			jobLabels:  []string{},
			estSeconds: 10,
			poolLabels: [][]string{{"local"}, {"cloud"}},
			wantReason: "local (fast job)",
		},
		{
			name:       "heavy job prefers cloud",
			jobLabels:  []string{},
			estSeconds: 600,
			poolLabels: [][]string{{"local"}, {"cloud"}},
			wantReason: "cloud (heavy build)",
		},
		{
			name:       "burst when no idle runners",
			jobLabels:  []string{},
			estSeconds: 60,
			poolLabels: [][]string{},
			wantReason: "burst (no idle runners)",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pool := NewPool(0, 10)
			for i, labels := range tt.poolLabels {
				pool.Add(&Runner{
					ID:     idForIndex(i),
					Status: StatusIdle,
					Labels: labels,
				})
			}
			job := &Job{
				ID:         "j1",
				Labels:     tt.jobLabels,
				Steps:      []string{"test"},
				EstSeconds: tt.estSeconds,
			}
			router := NewRouter()
			_, reason := router.Route(job, pool)
			if reason != tt.wantReason {
				t.Errorf("got reason %q, want %q", reason, tt.wantReason)
			}
		})
	}
}

func idForIndex(i int) string {
	return string(rune('A' + i))
}
