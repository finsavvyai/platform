package domain

import (
	"fmt"
	"strconv"
	"strings"
)

// MinSyncsPerDay is the floor we enforce for per-tenant list sync cadence.
// 7 syncs/day → at most ~3.43h between runs.
const MinSyncsPerDay = 7

// DefaultSyncSchedule runs every 3 hours (8 times per day).
const DefaultSyncSchedule = "0 */3 * * *"

// ValidateSyncSchedule checks that a cron expression runs at least
// MinSyncsPerDay times per day. Returns a human-readable error otherwise.
// Supported forms:
//   - "M */N * * *" — every N hours  → 24/N syncs per day
//   - "*/M * * * *" — every M minutes → 1440/M syncs per day
//   - "M H * * *"   — once per day (REJECTED as below minimum)
func ValidateSyncSchedule(expr string) error {
	parts := strings.Fields(strings.TrimSpace(expr))
	if len(parts) != 5 {
		return fmt.Errorf("schedule must be 5-field cron expression")
	}
	syncs, err := syncsPerDay(parts)
	if err != nil {
		return err
	}
	if syncs < MinSyncsPerDay {
		return fmt.Errorf(
			"schedule runs only %d/day; minimum is %d/day (try %q)",
			syncs, MinSyncsPerDay, DefaultSyncSchedule,
		)
	}
	return nil
}

// syncsPerDay returns how many times per day the schedule fires.
func syncsPerDay(parts []string) (int, error) {
	minute, hour := parts[0], parts[1]
	if n := parseStepInterval(minute); n > 0 {
		if n > 1440 {
			return 0, fmt.Errorf("invalid minute step: %s", minute)
		}
		return 1440 / n, nil
	}
	if n := parseStepInterval(hour); n > 0 {
		if n > 24 {
			return 0, fmt.Errorf("invalid hour step: %s", hour)
		}
		return 24 / n, nil
	}
	// Fixed hour like "0 3 * * *" — once per day.
	return 1, nil
}

// parseStepInterval parses "*/N" and returns N, or 0 if not a step field.
func parseStepInterval(field string) int {
	if !strings.HasPrefix(field, "*/") {
		return 0
	}
	n, err := strconv.Atoi(field[2:])
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

// NormalizeSyncSchedule coerces an invalid/empty schedule to the default.
// Use this when accepting legacy data that may predate the minimum rule.
func NormalizeSyncSchedule(expr string) string {
	if ValidateSyncSchedule(expr) == nil {
		return expr
	}
	return DefaultSyncSchedule
}
