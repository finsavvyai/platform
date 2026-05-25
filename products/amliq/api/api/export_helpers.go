package api

import (
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func parseTime(s string, def time.Time) time.Time {
	if s == "" {
		return def
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	return def
}

func filterByDateRange(screenings []domain.ScreenResponse,
	from, to time.Time) []domain.ScreenResponse {
	var filtered []domain.ScreenResponse
	for _, sr := range screenings {
		if (sr.Timestamp.After(from) || sr.Timestamp.Equal(from)) &&
			(sr.Timestamp.Before(to) || sr.Timestamp.Equal(to)) {
			filtered = append(filtered, sr)
		}
	}
	return filtered
}
