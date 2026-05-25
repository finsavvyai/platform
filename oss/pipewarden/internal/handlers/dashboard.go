package handlers

import (
	"net/http"
	"time"
)

// DashboardOverview handles GET /api/v1/dashboard/overview
func (h *Handlers) DashboardOverview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	connCount, _ := h.db.Count()
	stats, _ := h.db.GetFindingStats()
	history, _ := h.db.ListAnalysisHistory("")
	findings, _ := h.db.ListFindings("")

	// Calculate overall security score (inverse of risk)
	avgRisk := 0
	if len(history) > 0 {
		totalRisk := 0
		for _, h := range history {
			totalRisk += h.RiskScore
		}
		avgRisk = totalRisk / len(history)
	}
	securityScore := 100 - avgRisk

	// Find oldest open finding
	oldestOpen := ""
	openCount := 0
	for _, f := range findings {
		if f.Status == "open" {
			openCount++
			if oldestOpen == "" {
				oldestOpen = f.CreatedAt.Format(time.RFC3339)
			}
		}
	}

	// Recent analysis trend (last 10)
	recentScores := make([]map[string]interface{}, 0)
	limit := 10
	if len(history) < limit {
		limit = len(history)
	}
	for i := 0; i < limit; i++ {
		h := history[i]
		recentScores = append(recentScores, map[string]interface{}{
			"date":       h.AnalyzedAt.Format("2006-01-02"),
			"risk_score": h.RiskScore,
			"findings":   h.FindingsCount,
			"connection": h.ConnectionName,
		})
	}

	// Top recommendations
	recommendations := buildRecommendations(stats, openCount, connCount, findings)

	jsonOK(w, map[string]interface{}{
		"security_score":  securityScore,
		"connections":     connCount,
		"total_analyses":  len(history),
		"total_findings":  len(findings),
		"open_findings":   openCount,
		"oldest_open":     oldestOpen,
		"severity_counts": stats,
		"recent_trend":    recentScores,
		"recommendations": recommendations,
	})
}
