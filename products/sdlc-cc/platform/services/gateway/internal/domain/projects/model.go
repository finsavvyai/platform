// Package projects — domain models for shared projects.
//
// Day 53 deliverable. A project is tenant-scoped, has a member roster,
// and attaches zero or more connectors. The data layer enforces RLS;
// this package additionally checks tenant_id at the service layer for
// belt-and-suspenders.
package projects

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Role enumerates project membership roles.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

// Validate reports whether r is a known role.
func (r Role) Validate() error {
	switch r {
	case RoleOwner, RoleEditor, RoleViewer:
		return nil
	}
	return errors.New("projects: unknown role")
}

// Project is the aggregate root.
type Project struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	SystemPrompt string     `json:"system_prompt"`
	CreatedBy    uuid.UUID  `json:"created_by"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	Members      []Member   `json:"members,omitempty"`
	ConnectorIDs []uuid.UUID `json:"connector_ids,omitempty"`
}

// Member is one row of the project_members table.
type Member struct {
	ProjectID uuid.UUID `json:"project_id"`
	UserID    uuid.UUID `json:"user_id"`
	Role      Role      `json:"role"`
	AddedAt   time.Time `json:"added_at"`
}

// CreateInput is the validated POST /v1/projects body.
type CreateInput struct {
	Name         string
	Description  string
	SystemPrompt string
}

// UpdateInput is the validated PUT /v1/projects/{id} body. All fields
// are optional pointers so callers can patch a subset.
type UpdateInput struct {
	Name         *string
	Description  *string
	SystemPrompt *string
}

// Validate enforces input-shape rules. Tenant isolation is enforced
// elsewhere (in the service + RLS); this only checks user-visible
// constraints.
func (in CreateInput) Validate() error {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return ErrInvalidName
	}
	if len(name) > 200 {
		return ErrInvalidName
	}
	return nil
}

// Validate for UpdateInput: any provided field must satisfy the same
// constraints as CreateInput.
func (in UpdateInput) Validate() error {
	if in.Name != nil {
		n := strings.TrimSpace(*in.Name)
		if n == "" || len(n) > 200 {
			return ErrInvalidName
		}
	}
	return nil
}

// Sentinel errors surface as 400/403/404 in the handler layer.
var (
	ErrInvalidName  = errors.New("projects: name must be 1..200 chars")
	ErrNotFound     = errors.New("projects: not found")
	ErrCrossTenant  = errors.New("projects: cross-tenant access denied")
	ErrInvalidRole  = errors.New("projects: invalid role")
	ErrNotMember    = errors.New("projects: user is not a project member")
)
