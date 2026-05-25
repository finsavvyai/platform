// Read-only Compliance API for SOC officers + auditors.
//
// Day 32 of the production-ready roadmap.
//
// Versioned, rate-limited separately, gated by `compliance:read`.
//   GET /compliance/audit-events
//   GET /compliance/access-controls
//   GET /compliance/data-flow
//   GET /compliance/retention-status
//   GET /compliance/dlp-events
package handlers

import (
	"context"
	"net/http"
)

// ComplianceReader supplies the underlying data. Same shape as the
// audit + spend repos so production wires once.
type ComplianceReader interface {
	AuditEvents(ctx context.Context) (interface{}, error)
	AccessControls(ctx context.Context) (interface{}, error)
	DataFlow(ctx context.Context) (interface{}, error)
	RetentionStatus(ctx context.Context) (interface{}, error)
	DLPEvents(ctx context.Context) (interface{}, error)
}

// ComplianceDeps wires the handler.
type ComplianceDeps struct {
	Reader ComplianceReader
}

// AuditEventsHandler is GET /compliance/audit-events.
func AuditEventsHandler(deps ComplianceDeps) http.HandlerFunc {
	return jsonHandler(deps.Reader.AuditEvents)
}

// AccessControlsHandler is GET /compliance/access-controls.
func AccessControlsHandler(deps ComplianceDeps) http.HandlerFunc {
	return jsonHandler(deps.Reader.AccessControls)
}

// DataFlowHandler is GET /compliance/data-flow.
func DataFlowHandler(deps ComplianceDeps) http.HandlerFunc {
	return jsonHandler(deps.Reader.DataFlow)
}

// RetentionStatusHandler is GET /compliance/retention-status.
func RetentionStatusHandler(deps ComplianceDeps) http.HandlerFunc {
	return jsonHandler(deps.Reader.RetentionStatus)
}

// DLPEventsHandler is GET /compliance/dlp-events.
func DLPEventsHandler(deps ComplianceDeps) http.HandlerFunc {
	return jsonHandler(deps.Reader.DLPEvents)
}

// jsonHandler is shared error-handling glue: load -> 200 JSON or
// 500. The compliance API is intentionally simple — it's a read-only
// projection over data the rest of the system already maintains.
func jsonHandler(load func(ctx context.Context) (interface{}, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		v, err := load(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Compliance-API-Version", "2026-04-01")
		writeJSON(w, http.StatusOK, v)
	}
}
