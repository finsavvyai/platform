package ingestion

import (
	"strconv"
	"strings"
	"time"
)

// nextCronRunSafe parses a simple cron expression and returns the
// next run time after the given instant. Falls back to 24 h if
// the expression cannot be parsed.
func nextCronRunSafe(expr string, after time.Time) time.Time {
	fields := strings.Fields(expr)
	if len(fields) < 5 {
		return after.Add(24 * time.Hour)
	}
	hour, err := strconv.Atoi(fields[1])
	if err != nil || hour < 0 || hour > 23 {
		return after.Add(24 * time.Hour)
	}
	minute, err := strconv.Atoi(fields[0])
	if err != nil || minute < 0 || minute > 59 {
		minute = 0
	}
	next := time.Date(
		after.Year(), after.Month(), after.Day(),
		hour, minute, 0, 0, after.Location(),
	)
	if !next.After(after) {
		next = next.Add(24 * time.Hour)
	}
	return next
}
