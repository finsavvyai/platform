package heal

import (
	"context"
	"log"
	"time"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/runner"
)

// RetryConfig controls auto-retry behavior.
type RetryConfig struct {
	MaxAttempts int
	Backoff     time.Duration
	FixBetween  bool
}

// DefaultRetryConfig returns sensible retry defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts: 3,
		Backoff:     2 * time.Second,
		FixBetween:  true,
	}
}

// RetryResult holds the outcome of a retry loop.
type RetryResult struct {
	Passed   bool
	Attempts int
	Fixes    []Fix
	FinalRun *runner.Run
}

// RetryWithFix runs the pipeline, applies fixes, and retries.
func (h *Healer) RetryWithFix(ctx context.Context, root string, projects []detect.Project, cfg RetryConfig) *RetryResult {
	result := &RetryResult{}
	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		result.Attempts = attempt
		run := runner.Execute(ctx, root, projects)
		result.FinalRun = run
		if run.Passed {
			result.Passed = true
			return result
		}
		if attempt == cfg.MaxAttempts {
			break
		}
		if cfg.FixBetween {
			healResult, err := h.Heal(ctx, run, root)
			if err != nil {
				log.Printf("retry: heal failed: %v", err)
			}
			if healResult != nil {
				result.Fixes = append(result.Fixes, healResult.Fixes...)
			}
		}
		time.Sleep(cfg.Backoff)
	}
	return result
}
