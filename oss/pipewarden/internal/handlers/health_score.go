package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// HealthScore is the overall security health score for a connection.
type HealthScore struct {
	Connection     string           `json:"connection"`
	Score          int              `json:"score"`
	Grade          string           `json:"grade"`
	Dimensions     []ScoreDimension `json:"dimensions"`
	LastCalculated time.Time        `json:"last_calculated"`
	Trend          string           `json:"trend"`
}

// ScoreDimension is a single weighted component of the health score.
type ScoreDimension struct {
	Name    string `json:"name"`
	Score   int    `json:"score"`
	Weight  int    `json:"weight"`
	Status  string `json:"status"`
	Details string `json:"details"`
}

// GetHealthScore handles GET /api/v1/connections/{name}/health
func (h *Handlers) GetHealthScore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	name = strings.TrimSuffix(name, "/health")
	if name == "" {
		jsonError(w, "connection name required", http.StatusBadRequest)
		return
	}

	findings, err := h.db.ListFindings(name)
	if err != nil {
		jsonError(w, "failed to load findings: "+err.Error(), http.StatusInternalServerError)
		return
	}

	lastScan, err := h.db.LastAnalysisTimeForConnection(name)
	if err != nil {
		jsonError(w, "failed to load scan time: "+err.Error(), http.StatusInternalServerError)
		return
	}

	trends, err := h.db.FindingTrends(name, 14)
	if err != nil {
		jsonError(w, "failed to load trends: "+err.Error(), http.StatusInternalServerError)
		return
	}

	dims := calcDimensions(findings, lastScan)
	score := weightedScore(dims)
	jsonOK(w, HealthScore{
		Connection:     name,
		Score:          score,
		Grade:          scoreGrade(score),
		Dimensions:     dims,
		LastCalculated: time.Now().UTC(),
		Trend:          calcTrend(trends),
	})
}

// calcDimensions computes each scoring dimension from raw findings and scan time.
func calcDimensions(findings []storage.FindingRecord, lastScan *time.Time) []ScoreDimension {
	open := openFindings(findings)
	return []ScoreDimension{
		actionPinningDim(open),
		secretHygieneDim(open),
		containerSecurityDim(open),
		policyComplianceDim(open),
		scanRecencyDim(lastScan),
	}
}

func openFindings(all []storage.FindingRecord) []storage.FindingRecord {
	var out []storage.FindingRecord
	for _, f := range all {
		if f.Status == "open" {
			out = append(out, f)
		}
	}
	return out
}

func weightedScore(dims []ScoreDimension) int {
	total := 0
	for _, d := range dims {
		total += d.Score * d.Weight
	}
	return total / 100
}

func scoreGrade(score int) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 75:
		return "B"
	case score >= 60:
		return "C"
	case score >= 40:
		return "D"
	default:
		return "F"
	}
}

// calcTrend compares the last 7 days vs the prior 7 days of findings.
func calcTrend(trends []storage.TrendPoint) string {
	now := time.Now().UTC()
	cutoff7 := now.AddDate(0, 0, -7).Format("2006-01-02")
	var recent, prior int
	for _, tp := range trends {
		if tp.Date >= cutoff7 {
			recent += tp.Total
		} else {
			prior += tp.Total
		}
	}
	delta := recent - prior
	switch {
	case delta > 5:
		return "degrading"
	case delta < -5:
		return "improving"
	default:
		return "stable"
	}
}
