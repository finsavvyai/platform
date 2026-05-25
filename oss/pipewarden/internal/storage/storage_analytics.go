package storage

import (
	"fmt"
	"time"
)

// TrendPoint holds finding counts for a single day.
type TrendPoint struct {
	Date     string `json:"date"`
	Total    int    `json:"total"`
	Critical int    `json:"critical"`
	High     int    `json:"high"`
	Medium   int    `json:"medium"`
	Low      int    `json:"low"`
}

// SummaryResponse holds aggregate finding metrics.
type SummaryResponse struct {
	TotalFindings  int     `json:"total_findings"`
	OpenFindings   int     `json:"open_findings"`
	Suppressed     int     `json:"suppressed"`
	Resolved       int     `json:"resolved"`
	RiskScore      int     `json:"risk_score"`
	TopConnection  string  `json:"top_connection"`
	TrendDirection string  `json:"trend_direction"`
	ChangePercent  float64 `json:"change_percent"`
}

// FindingTrends returns per-day finding counts for the last N days.
func (s *DB) FindingTrends(connectionName string, days int) ([]TrendPoint, error) {
	if days <= 0 {
		days = 30
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -days)
	args := []interface{}{cutoff}
	filter := ""
	if connectionName != "" {
		filter = " AND connection_name = ?"
		args = append(args, connectionName)
	}

	query := s.bind(`SELECT DATE(created_at) as day,
		COUNT(*) as total,
		SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) as critical,
		SUM(CASE WHEN severity='high' THEN 1 ELSE 0 END) as high,
		SUM(CASE WHEN severity='medium' THEN 1 ELSE 0 END) as medium,
		SUM(CASE WHEN severity='low' THEN 1 ELSE 0 END) as low
		FROM security_findings
		WHERE created_at >= ?` + filter + `
		GROUP BY DATE(created_at)
		ORDER BY day ASC`)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("finding trends query failed: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var points []TrendPoint
	for rows.Next() {
		var p TrendPoint
		if err := rows.Scan(&p.Date, &p.Total, &p.Critical, &p.High, &p.Medium, &p.Low); err != nil {
			return nil, fmt.Errorf("scan trend point: %w", err)
		}
		points = append(points, p)
	}
	if points == nil {
		points = []TrendPoint{}
	}
	return points, rows.Err()
}

// FindingSummary returns aggregate counts and a risk score.
func (s *DB) FindingSummary() (*SummaryResponse, error) {
	var r SummaryResponse

	// Wrap SUM(CASE ...) in COALESCE so an empty table returns 0 rather than
	// NULL, which would fail Scan into int.
	countQuery := `SELECT
		COUNT(*) as total,
		COALESCE(SUM(CASE WHEN status='open' THEN 1 ELSE 0 END), 0) as open_count,
		COALESCE(SUM(CASE WHEN status='suppressed' THEN 1 ELSE 0 END), 0) as suppressed,
		COALESCE(SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END), 0) as resolved
		FROM security_findings`

	row := s.db.QueryRow(countQuery)
	if err := row.Scan(&r.TotalFindings, &r.OpenFindings, &r.Suppressed, &r.Resolved); err != nil {
		return nil, fmt.Errorf("summary count query: %w", err)
	}

	// Risk score: weight by severity of open findings (0-100)
	riskQuery := `SELECT COALESCE(SUM(
		CASE severity
			WHEN 'critical' THEN 40
			WHEN 'high' THEN 20
			WHEN 'medium' THEN 5
			ELSE 1
		END), 0) FROM security_findings WHERE status='open'`
	var rawRisk int
	_ = s.db.QueryRow(riskQuery).Scan(&rawRisk)
	if rawRisk > 100 {
		rawRisk = 100
	}
	r.RiskScore = rawRisk

	// Top connection by open finding count
	topQuery := `SELECT connection_name FROM security_findings
		WHERE status='open'
		GROUP BY connection_name
		ORDER BY COUNT(*) DESC LIMIT 1`
	_ = s.db.QueryRow(topQuery).Scan(&r.TopConnection)

	// Trend: compare last 7 days vs prior 7 days
	now := time.Now().UTC()
	week1Start := now.AddDate(0, 0, -7)
	week2Start := now.AddDate(0, 0, -14)
	var recent, prior int
	_ = s.db.QueryRow(s.bind(`SELECT COUNT(*) FROM security_findings WHERE created_at >= ?`), week1Start).Scan(&recent)
	_ = s.db.QueryRow(s.bind(`SELECT COUNT(*) FROM security_findings WHERE created_at >= ? AND created_at < ?`), week2Start, week1Start).Scan(&prior)

	if prior == 0 {
		if recent > 0 {
			r.TrendDirection = "up"
			r.ChangePercent = 100.0
		} else {
			r.TrendDirection = "stable"
		}
	} else {
		diff := float64(recent-prior) / float64(prior) * 100
		r.ChangePercent = diff
		switch {
		case diff > 5:
			r.TrendDirection = "up"
		case diff < -5:
			r.TrendDirection = "down"
		default:
			r.TrendDirection = "stable"
		}
	}

	return &r, nil
}

// TopFindingCategories returns the top N finding categories by count.
func (s *DB) TopFindingCategories(limit int) ([]map[string]interface{}, error) {
	if limit <= 0 {
		limit = 10
	}
	query := s.bind(`SELECT category, COUNT(*) as count
		FROM security_findings
		GROUP BY category
		ORDER BY count DESC
		LIMIT ?`)

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("top categories query: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var results []map[string]interface{}
	for rows.Next() {
		var category string
		var count int
		if err := rows.Scan(&category, &count); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		results = append(results, map[string]interface{}{
			"category": category,
			"count":    count,
		})
	}
	if results == nil {
		results = []map[string]interface{}{}
	}
	return results, rows.Err()
}
