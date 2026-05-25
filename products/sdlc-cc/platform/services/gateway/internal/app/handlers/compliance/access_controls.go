// Compliance — access controls (RBAC matrix snapshot).
//
// GET /compliance/access-controls?tenant_id=
//
// Returns the current roles, permissions, and assignments for a
// tenant. SOC auditors use this to verify least-privilege.
//
// Day 32 of the production-ready roadmap.
package compliance

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// RBACReader is the minimal slice the handler needs.
type RBACReader interface {
	Snapshot(ctx context.Context, tenantID uuid.UUID) (RBACSnapshot, error)
}

// RBACSnapshot is the JSON shape returned. Stable across versions.
type RBACSnapshot struct {
	TenantID    uuid.UUID    `json:"tenant_id"`
	GeneratedAt time.Time    `json:"generated_at"`
	Roles       []Role       `json:"roles"`
	Assignments []Assignment `json:"assignments"`
}

// Role is one role + the permissions it grants.
type Role struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Permissions []string `json:"permissions"`
}

// Assignment binds a user to a role within a scope.
type Assignment struct {
	UserID   uuid.UUID `json:"user_id"`
	RoleName string    `json:"role_name"`
	Scope    string    `json:"scope,omitempty"`
}

// AccessControlsDeps wires the reader.
type AccessControlsDeps struct {
	Reader RBACReader
}

// AccessControlsHandler returns the http.HandlerFunc.
func AccessControlsHandler(deps AccessControlsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, err := requiredTenantID(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		snap, err := deps.Reader.Snapshot(r.Context(), tenantID)
		if err != nil {
			http.Error(w, "rbac snapshot failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if snap.GeneratedAt.IsZero() {
			snap.GeneratedAt = time.Now().UTC()
		}
		snap.TenantID = tenantID
		writeComplianceJSON(w, http.StatusOK, snap)
	}
}

// requiredTenantID extracts ?tenant_id= and validates it as a UUID.
// Compliance APIs always require an explicit tenant scope so the
// caller can't accidentally pull cross-tenant data.
func requiredTenantID(r *http.Request) (uuid.UUID, error) {
	raw := r.URL.Query().Get("tenant_id")
	if raw == "" {
		return uuid.Nil, &errBadQuery{"tenant_id is required"}
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, &errBadQuery{"tenant_id must be a UUID"}
	}
	return id, nil
}
