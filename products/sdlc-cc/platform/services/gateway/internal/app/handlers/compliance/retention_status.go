// Compliance — retention status report.
//
// GET /compliance/retention-status?tenant_id=
//
// For each data type the tenant has configured retention for, returns:
//   - retention_days
//   - last sweeper run timestamp
//   - oldest row currently retained (so auditors can verify the
//     sweeper actually deleted past-retention data)
//
// Day 32 of the production-ready roadmap.
package compliance

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// RetentionReader is the minimal slice the handler needs.
type RetentionReader interface {
	Status(ctx context.Context, tenantID uuid.UUID) (RetentionReport, error)
}

// RetentionReport is the JSON shape returned.
type RetentionReport struct {
	TenantID    uuid.UUID         `json:"tenant_id"`
	GeneratedAt time.Time         `json:"generated_at"`
	Items       []RetentionStatus `json:"items"`
}

// RetentionStatus is one (data_type) entry.
type RetentionStatus struct {
	DataType        string     `json:"data_type"`
	RetentionDays   int        `json:"retention_days"`
	LastSweepAt     *time.Time `json:"last_sweep_at,omitempty"`
	OldestRowAt     *time.Time `json:"oldest_row_at,omitempty"`
	LegalHoldUntil  *time.Time `json:"legal_hold_until,omitempty"`
}

// RetentionDeps wires the reader.
type RetentionDeps struct {
	Reader RetentionReader
}

// RetentionStatusHandler returns the http.HandlerFunc.
func RetentionStatusHandler(deps RetentionDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, err := requiredTenantID(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		rep, err := deps.Reader.Status(r.Context(), tenantID)
		if err != nil {
			http.Error(w, "retention status failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if rep.GeneratedAt.IsZero() {
			rep.GeneratedAt = time.Now().UTC()
		}
		rep.TenantID = tenantID
		writeComplianceJSON(w, http.StatusOK, rep)
	}
}
