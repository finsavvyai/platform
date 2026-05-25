// Wire types and store interfaces shared across the package.
// Pulled out of users.go on Day 23 to keep every file ≤200 LOC.
package scim

import (
	"context"
	"errors"
	"net/http"
	"time"
)

const (
	// UserSchema is the core SCIM 2.0 User schema URN.
	UserSchema = "urn:ietf:params:scim:schemas:core:2.0:User"
	// ListResponseSchema wraps search results.
	ListResponseSchema = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
	// ErrorSchema is the error envelope.
	ErrorSchema = "urn:ietf:params:scim:api:messages:2.0:Error"
	// PatchOpSchema is the PATCH request envelope.
	PatchOpSchema = "urn:ietf:params:scim:api:messages:2.0:PatchOp"
)

// User is a simplified SCIM 2.0 User resource.
type User struct {
	Schemas  []string `json:"schemas"`
	ID       string   `json:"id"`
	UserName string   `json:"userName"`
	Active   bool     `json:"active"`
	Name     UserName `json:"name,omitempty"`
	Emails   []Email  `json:"emails,omitempty"`
	TenantID string   `json:"-"`
	Meta     Meta     `json:"meta"`
}

// UserName matches the SCIM name sub-object.
type UserName struct {
	Formatted  string `json:"formatted,omitempty"`
	FamilyName string `json:"familyName,omitempty"`
	GivenName  string `json:"givenName,omitempty"`
}

// Email is a SCIM email entry.
type Email struct {
	Value   string `json:"value"`
	Type    string `json:"type,omitempty"`
	Primary bool   `json:"primary,omitempty"`
}

// Meta is the SCIM metadata block. Version is the ETag concurrency
// token added on Day 23.
type Meta struct {
	ResourceType string    `json:"resourceType"`
	Created      time.Time `json:"created"`
	LastModified time.Time `json:"lastModified"`
	Location     string    `json:"location,omitempty"`
	Version      string    `json:"version,omitempty"`
}

// Store persists SCIM Users.
type Store interface {
	Create(ctx context.Context, u User) (User, error)
	Get(ctx context.Context, tenantID, id string) (User, error)
	Delete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, u User) (User, error)
	Search(ctx context.Context, tenantID string, filter Filter) ([]User, int, error)
}

// Filter captures a parsed SCIM filter expression plus pagination.
type Filter struct {
	UserNameEq string
	Start      int
	Count      int
}

// TenantResolver returns the authenticated tenant for a request.
type TenantResolver func(*http.Request) (tenantID string, err error)

// ErrNotFound signals a 404 path.
var ErrNotFound = errors.New("scim: resource not found")

// ErrConflict signals a 409 on duplicate userName.
var ErrConflict = errors.New("scim: conflict")

// AuditHook is called after each mutating SCIM operation. tenantID and
// action (e.g. "scim.user.create") are always set; target is the
// resource path (e.g. "scim/Users/abc"). Returning an error fails the
// request (fail-closed). A nil hook is a no-op.
type AuditHook func(ctx context.Context, action, target, tenantID string) error

// Handler wires SCIM routes onto an existing mux.
type Handler struct {
	Store      Store
	GroupStore GroupStore // optional; nil disables /Groups
	BulkLimit  int        // optional; defaults to 1000
	Tenant     TenantResolver
	BasePath   string // e.g. "/scim/v2"
	// Audit is called after each create/update/delete. Optional.
	Audit AuditHook
}

// Register installs routes on the provided mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc(h.BasePath+"/Users", h.users)
	mux.HandleFunc(h.BasePath+"/Users/", h.user)
	if h.GroupStore != nil {
		mux.HandleFunc(h.BasePath+"/Groups", h.groups)
		mux.HandleFunc(h.BasePath+"/Groups/", h.group)
	}
	mux.HandleFunc(h.BasePath+"/Bulk", h.bulk)
}
