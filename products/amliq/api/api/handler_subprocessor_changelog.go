package api

import "net/http"

// SubProcessorChange represents one entry in the public sub-processor
// directory changelog. GDPR Art. 28 (and SOC 2 PRI-1) want customers
// to be informed of every addition / removal of an external processor
// before data flows. Publishing the changelog at a stable URL is the
// minimum bar; an opt-out workflow would be the next step.
type SubProcessorChange struct {
	Date    string `json:"date"`    // ISO-8601 date
	Action  string `json:"action"`  // added | removed | updated
	Name    string `json:"name"`    // processor name
	Reason  string `json:"reason"`  // short justification
	Effective string `json:"effective_date"` // when the change took effect
}

// SubProcessorChangelog returns the published change history. New
// entries are prepended at deploy time after the matching entry in
// SubProcessors() is added or removed.
func SubProcessorChangelog() []SubProcessorChange {
	return []SubProcessorChange{
		{
			Date:      "2026-04-29",
			Action:    "added",
			Name:      "OpenSanctions",
			Reason:    "PEP and sanctions data ingestion (read-only)",
			Effective: "2026-04-29",
		},
		{
			Date:      "2026-04-29",
			Action:    "added",
			Name:      "PostgreSQL hosting",
			Reason:    "primary application database",
			Effective: "2026-04-29",
		},
		{
			Date:      "2026-04-29",
			Action:    "added",
			Name:      "LemonSqueezy",
			Reason:    "subscription billing and tax collection",
			Effective: "2026-04-29",
		},
	}
}

// HandleSubProcessorChangelog serves
// GET /api/v1/privacy/subprocessors/changelog as public JSON.
func HandleSubProcessorChangelog(w http.ResponseWriter, _ *http.Request) {
	Success(w, map[string]any{
		"changelog": SubProcessorChangelog(),
	}, http.StatusOK)
}
