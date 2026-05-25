package handlers

import (
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations/demo"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

const demoConnectionName = "demo-github"

// LoadDemoWorkspace seeds a realistic demo workspace for walkthroughs.
func (h *Handlers) LoadDemoWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	now := time.Now().UTC()
	rec := &storage.ConnectionRecord{
		Name:             demoConnectionName,
		Platform:         "github",
		AuthMethod:       "demo",
		ProviderIdentity: demo.DemoOwner,
		HealthStatus:     "connected",
		LastVerifiedAt:   &now,
	}
	if err := h.db.SaveConnection(rec); err != nil {
		jsonError(w, "failed to save demo connection", http.StatusInternalServerError)
		return
	}

	provider := buildProvider(rec.Platform, rec.AuthMethod, "", "", "", "", h.cfg, h.logger)
	if provider != nil {
		h.manager.Replace(rec.Name, provider)
	}

	findingsCreated := h.seedDemoFindings(now)
	historyCreated := h.seedDemoHistory(now)

	jsonOK(w, map[string]interface{}{
		"status":             "loaded",
		"connection_name":    rec.Name,
		"platform":           rec.Platform,
		"owner":              demo.DemoOwner,
		"repo":               demo.DemoRepo,
		"recommended_run_id": "run-103",
		"findings_created":   findingsCreated,
		"history_created":    historyCreated,
	})
}

func (h *Handlers) seedDemoFindings(now time.Time) int {
	existing, err := h.db.ListFindings(demoConnectionName)
	if err == nil && len(existing) > 0 {
		return 0
	}

	findings := []*storage.FindingRecord{
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-101",
			Severity:       "critical",
			Category:       "secrets",
			Title:          "Deployment token exposed in release workflow",
			Description:    "The release workflow contains a deploy token in an inline shell step, which would allow unauthorized registry access if logs are exposed.",
			Remediation:    "Move the token to the secret store and rotate the credential after remediation.",
			File:           ".github/workflows/release.yml",
			Line:           44,
			Confidence:     0.98,
			Status:         "open",
			CreatedAt:      now.Add(-48 * time.Hour),
		},
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-101",
			Severity:       "high",
			Category:       "policy",
			Title:          "Release job bypasses required security checks",
			Description:    "The production deploy job can run without a passing SAST gate on non-main branches.",
			Remediation:    "Require the security-review workflow to pass before deploy.",
			File:           ".github/workflows/release.yml",
			Line:           89,
			Confidence:     0.91,
			Status:         "acknowledged",
			CreatedAt:      now.Add(-36 * time.Hour),
		},
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-102",
			Severity:       "medium",
			Category:       "supply-chain",
			Title:          "Base image pinning is missing in test pipeline",
			Description:    "The container step uses a floating base image tag, increasing the chance of unreviewed dependency drift.",
			Remediation:    "Pin the container image digest in the workflow definition.",
			File:           ".github/workflows/test.yml",
			Line:           17,
			Confidence:     0.77,
			Status:         "resolved",
			CreatedAt:      now.Add(-12 * time.Hour),
		},
	}

	created := 0
	for _, finding := range findings {
		if err := h.db.CreateFinding(finding); err == nil {
			created++
			if h.localSearch != nil {
				h.localSearch.Add(findingDoc{*finding})
			}
		}
	}
	return created
}

func (h *Handlers) seedDemoHistory(now time.Time) int {
	existing, err := h.db.ListAnalysisHistory(demoConnectionName)
	if err == nil && len(existing) > 0 {
		return 0
	}

	history := []*storage.AnalysisRecord{
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-101",
			Summary:        "Release pipeline exposes a deployment credential and lacks a blocking security gate.",
			RiskScore:      82,
			FindingsCount:  2,
			TokensUsed:     842,
			Model:          "claude-sonnet-4-20250514",
			DurationMS:     2840,
			AnalyzedAt:     now.Add(-48 * time.Hour),
		},
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-102",
			Summary:        "Main branch verification run is mostly healthy with one medium supply-chain hardening recommendation.",
			RiskScore:      34,
			FindingsCount:  1,
			TokensUsed:     0,
			Model:          "heuristic-v1",
			DurationMS:     612,
			AnalyzedAt:     now.Add(-12 * time.Hour),
		},
		{
			ConnectionName: demoConnectionName,
			RunID:          "run-103",
			Summary:        "Feature branch run passes with no new exploitable findings.",
			RiskScore:      18,
			FindingsCount:  0,
			TokensUsed:     0,
			Model:          "heuristic-v1",
			DurationMS:     501,
			AnalyzedAt:     now.Add(-2 * time.Hour),
		},
	}

	created := 0
	for _, rec := range history {
		if err := h.db.CreateAnalysisRecord(rec); err == nil {
			created++
		}
	}
	return created
}
