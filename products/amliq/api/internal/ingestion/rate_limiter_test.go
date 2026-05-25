package ingestion

import (
	"testing"
	"time"
)

func TestDownloadLimiter(t *testing.T) {
	tests := []struct {
		name        string
		interval    time.Duration
		calls       int
		wantMinTime time.Duration
	}{
		{
			name:        "first call is immediate",
			interval:    50 * time.Millisecond,
			calls:       1,
			wantMinTime: 0,
		},
		{
			name:        "two calls enforce interval",
			interval:    50 * time.Millisecond,
			calls:       2,
			wantMinTime: 50 * time.Millisecond,
		},
		{
			name:        "three calls enforce twice",
			interval:    50 * time.Millisecond,
			calls:       3,
			wantMinTime: 100 * time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter := NewDownloadLimiter(tt.interval)
			start := time.Now()
			for i := 0; i < tt.calls; i++ {
				limiter.Wait()
			}
			elapsed := time.Since(start)
			if elapsed < tt.wantMinTime {
				t.Errorf("elapsed %v < min %v", elapsed, tt.wantMinTime)
			}
		})
	}
}
