package api

import (
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// buildScreeningVolume aggregates per-day screening counts.
// Falls back to an empty 7-day window when there's no history.
func buildScreeningVolume(s []domain.ScreenResponse) []map[string]interface{} {
	if len(s) == 0 {
		return defaultVolume()
	}
	daily := make(map[string]int)
	for _, sc := range s {
		day := sc.Timestamp.Format("Jan 02")
		daily[day]++
	}
	result := make([]map[string]interface{}, 0, len(daily))
	for day, count := range daily {
		result = append(result, map[string]interface{}{
			"date": day, "screenings": count,
		})
	}
	if len(result) == 0 {
		return defaultVolume()
	}
	return result
}

func defaultVolume() []map[string]interface{} {
	result := make([]map[string]interface{}, 0, 7)
	now := time.Now()
	for i := 6; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		result = append(result, map[string]interface{}{
			"date": d.Format("Jan 02"), "screenings": 0,
		})
	}
	return result
}

// buildDisposition returns three counters (Pending/Resolved/Escalated)
// formatted as the {name,value} array the dashboard expects.
func buildDisposition(alerts []domain.Alert) []map[string]interface{} {
	counts := map[string]int{"Pending": 0, "Resolved": 0, "Escalated": 0}
	for _, a := range alerts {
		switch a.Status {
		case domain.AlertStatusPending:
			counts["Pending"]++
		case domain.AlertStatusResolved:
			counts["Resolved"]++
		case domain.AlertStatusEscalated:
			counts["Escalated"]++
		}
	}
	result := make([]map[string]interface{}, 0, len(counts))
	for name, val := range counts {
		result = append(result, map[string]interface{}{
			"name": name, "value": val,
		})
	}
	return result
}

// buildRiskDist buckets screenings into Low/Medium/High/Critical by
// max-match confidence, mirroring the alert-severity thresholds.
func buildRiskDist(s []domain.ScreenResponse) []map[string]interface{} {
	buckets := map[string]int{"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
	for _, sc := range s {
		conf := sc.MaxConfidence()
		switch {
		case conf >= 0.9:
			buckets["Critical"]++
		case conf >= 0.7:
			buckets["High"]++
		case conf >= 0.4:
			buckets["Medium"]++
		default:
			buckets["Low"]++
		}
	}
	result := make([]map[string]interface{}, 0, len(buckets))
	for name, val := range buckets {
		result = append(result, map[string]interface{}{
			"name": name, "value": val,
		})
	}
	return result
}
