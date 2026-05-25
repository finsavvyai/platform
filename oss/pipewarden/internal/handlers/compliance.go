package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// GenerateComplianceReport handles GET /api/v1/compliance/{framework}.
// Supported frameworks: soc2, hipaa, gdpr, pci-dss.
func (h *Handlers) GenerateComplianceReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	framework := extractFramework(r.URL.Path)
	if _, ok := frameworkControls[framework]; !ok {
		jsonError(w, fmt.Sprintf("unknown framework %q: use soc2, hipaa, gdpr, or pci-dss", framework), http.StatusBadRequest)
		return
	}

	findings, err := h.db.ListFindings("")
	if err != nil {
		jsonError(w, fmt.Sprintf("failed to list findings: %s", err), http.StatusInternalServerError)
		return
	}

	from := parsePeriodParam(r.URL.Query().Get("from"))
	to := parsePeriodParam(r.URL.Query().Get("to"))
	scoped := applyPeriod(findings, from, to)

	report := buildComplianceReport(framework, scoped)
	report.PeriodFrom = from
	report.PeriodTo = to
	report.Coverage = computeCoverage(scoped)
	report.EvidenceHash = hashEvidence(framework, from, to, scoped)

	switch r.URL.Query().Get("format") {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-compliance-%s.csv"`, framework, time.Now().UTC().Format("2006-01-02")))
		_, _ = w.Write([]byte(renderCSV(report)))
	case "markdown", "md":
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-compliance-%s.md"`, framework, time.Now().UTC().Format("2006-01-02")))
		_, _ = w.Write([]byte(renderMarkdown(report)))
	default:
		jsonOK(w, report)
	}
}

// extractFramework parses the framework name from /api/v1/compliance/{framework}.
func extractFramework(path string) string {
	const prefix = "/api/v1/compliance/"
	return strings.ToLower(strings.TrimPrefix(path, prefix))
}

// buildComplianceReport assembles the full report for a framework.
func buildComplianceReport(framework string, findings []storage.FindingRecord) ComplianceReport {
	controls := frameworkControls[framework]

	// Map control ID → slice of finding IDs that violate it.
	controlViolations := make(map[string][]string, len(controls))
	for _, c := range controls {
		controlViolations[c.id] = []string{}
	}

	// Map finding ID → slice of control IDs it violates.
	findingControls := make(map[int64][]string, len(findings))
	for _, f := range findings {
		for _, c := range controls {
			if categoryMatchesControl(f.Category, c.category) {
				controlViolations[c.id] = append(controlViolations[c.id], fmt.Sprintf("%d", f.ID))
				findingControls[f.ID] = append(findingControls[f.ID], c.id)
			}
		}
	}

	// Build control list.
	builtControls := make([]ComplianceControl, 0, len(controls))
	passing, failing := 0, 0
	for _, c := range controls {
		viols := controlViolations[c.id]
		status := "passing"
		if len(viols) > 0 {
			status = "failing"
			failing++
		} else {
			passing++
		}
		builtControls = append(builtControls, ComplianceControl{
			ID:       c.id,
			Title:    c.title,
			Status:   status,
			Findings: viols,
		})
	}

	// Build finding list (only findings that map to at least one control).
	var builtFindings []ComplianceFinding
	for _, f := range findings {
		mapped := findingControls[f.ID]
		if len(mapped) == 0 {
			continue
		}
		builtFindings = append(builtFindings, ComplianceFinding{
			FindingID: f.ID,
			Severity:  f.Severity,
			Controls:  mapped,
		})
	}

	total := len(controls)
	score := 100
	if total > 0 {
		score = (passing * 100) / total
	}

	return ComplianceReport{
		Framework:   framework,
		GeneratedAt: time.Now().UTC(),
		Summary: ComplianceSummary{
			TotalControls: total,
			Passing:       passing,
			Failing:       failing,
			NotApplicable: 0,
			Score:         score,
		},
		Controls: builtControls,
		Findings: builtFindings,
	}
}
