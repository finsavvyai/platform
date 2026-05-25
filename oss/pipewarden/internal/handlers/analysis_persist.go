package handlers

import (
	"fmt"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// persistFindings stores findings and dispatches webhooks per finding.
func (h *Handlers) persistFindings(findings []analysis.Finding) {
	for i := range findings {
		f := &findings[i]
		rec := &storage.FindingRecord{
			ConnectionName: f.ConnectionName,
			RunID:          f.RunID,
			Severity:       string(f.Severity),
			Category:       string(f.Category),
			Title:          f.Title,
			Description:    f.Description,
			Remediation:    f.Remediation,
			File:           f.File,
			Line:           f.Line,
			Confidence:     f.Confidence,
			Status:         f.Status,
		}
		if err := h.db.CreateFinding(rec); err != nil {
			h.logger.Errorw("Failed to persist finding", "error", err)
			continue
		}
		if h.localSearch != nil {
			h.localSearch.Add(findingDoc{*rec})
		}
		h.deliverFindingWebhook(rec)
	}
}

func (h *Handlers) persistAnalysisRecord(rec *storage.AnalysisRecord) {
	if err := h.db.CreateAnalysisRecord(rec); err != nil {
		h.logger.Errorw("Failed to persist analysis record", "error", err)
	}
}

// notifyCriticalFindings creates notifications for critical/high findings.
func (h *Handlers) notifyCriticalFindings(connectionName string, findings []analysis.Finding) {
	for i := range findings {
		f := &findings[i]
		sev := string(f.Severity)
		if sev != "critical" && sev != "high" {
			continue
		}
		title := fmt.Sprintf("%s finding: %s", sev, f.Title)
		body := f.Description
		_ = h.db.CreateNotification("finding_"+sev, title, body, connectionName)
	}
}
