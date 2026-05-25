package agent

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// parseCronInterval converts a simplified cron expression to a duration.
// Supports: "0 0 1 * *" (monthly), "0 6 * * *" (daily at 6am), etc.
func parseCronInterval(cron string) (time.Duration, error) {
	parts := strings.Fields(cron)
	if len(parts) != 5 {
		return 0, fmt.Errorf("expected 5 fields, got %d", len(parts))
	}
	// Simple heuristic: detect daily vs monthly.
	if parts[2] != "*" {
		return 30 * 24 * time.Hour, nil // monthly
	}
	if parts[1] != "*" {
		return 24 * time.Hour, nil // daily
	}
	if parts[0] != "*" {
		return 1 * time.Hour, nil // hourly
	}
	return 1 * time.Hour, nil
}

// checkAndRun fires full/delta scans when their scheduled time passes.
func (s *Scheduler) checkAndRun(now time.Time, onFull, onDelta func()) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.nextFullScan.IsZero() && now.After(s.nextFullScan) && onFull != nil {
		go onFull()
		interval, _ := parseCronInterval(s.fullCron)
		s.nextFullScan = now.Add(interval)
	}
	if !s.nextDeltaScan.IsZero() && now.After(s.nextDeltaScan) && onDelta != nil {
		go onDelta()
		interval, _ := parseCronInterval(s.deltaCron)
		s.nextDeltaScan = now.Add(interval)
	}
}

// Run blocks and executes scans according to schedule.
func (s *Scheduler) Run(ctx context.Context, onFull, onDelta func()) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopCh:
			return
		case now := <-ticker.C:
			s.checkAndRun(now, onFull, onDelta)
		}
	}
}
