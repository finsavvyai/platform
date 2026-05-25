// Package scim implements a minimal SCIM 2.0 Users endpoint for enterprise
// IdP provisioning (Okta, Azure AD, JumpCloud). It speaks the core RFC 7643
// User schema and the core RFC 7644 protocol — Create, Read, Search, Patch,
// Delete — scoped to the authenticated tenant.
//
// Non-goals for this iteration: Groups, bulk, discovery metadata, ETag
// concurrency. Those land when the first real IdP integration asks for
// them so we don't ship speculative surface area.
package scim

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
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

// User is a simplified SCIM 2.0 User resource. Fields match what Okta and
// Azure AD actually populate in practice; the rest stay off the wire.
type User struct {
	Schemas  []string  `json:"schemas"`
	ID       string    `json:"id"`
	UserName string    `json:"userName"`
	Active   bool      `json:"active"`
	Name     UserName  `json:"name,omitempty"`
	Emails   []Email   `json:"emails,omitempty"`
	TenantID string    `json:"-"`
	Meta     Meta      `json:"meta"`
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

// Meta is the standard SCIM metadata block.
type Meta struct {
	ResourceType string    `json:"resourceType"`
	Created      time.Time `json:"created"`
	LastModified time.Time `json:"lastModified"`
	Location     string    `json:"location,omitempty"`
}

// Store persists SCIM Users. Implementations back onto the platform's users
// table so SCIM-provisioned users are indistinguishable from native ones
// downstream.
type Store interface {
	Create(ctx context.Context, u User) (User, error)
	Get(ctx context.Context, tenantID, id string) (User, error)
	Delete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, u User) (User, error)
	Search(ctx context.Context, tenantID string, filter Filter) ([]User, int, error)
}

// Filter captures a parsed SCIM filter expression plus pagination.
// Only `userName eq "value"` is honored; unknown filters are ignored and
// a full list is returned (SCIM allows this).
type Filter struct {
	UserNameEq string
	Start      int
	Count      int
}

// TenantResolver returns the authenticated tenant for a request. Provided
// by the caller so the SCIM layer stays unaware of the auth strategy.
type TenantResolver func(*http.Request) (tenantID string, err error)

// ErrNotFound signals a 404 path.
var ErrNotFound = errors.New("scim: resource not found")

// ErrConflict signals a 409 on duplicate userName.
var ErrConflict = errors.New("scim: conflict")

// Handler wires SCIM routes onto an existing mux.
type Handler struct {
	Store    Store
	Tenant   TenantResolver
	BasePath string // e.g. "/scim/v2"
}

// Register installs routes on the provided mux. Routes:
//
//	POST   /scim/v2/Users
//	GET    /scim/v2/Users?filter=...&startIndex=1&count=100
//	GET    /scim/v2/Users/{id}
//	PATCH  /scim/v2/Users/{id}
//	PUT    /scim/v2/Users/{id}
//	DELETE /scim/v2/Users/{id}
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc(h.BasePath+"/Users", h.users)
	mux.HandleFunc(h.BasePath+"/Users/", h.user)
}

func (h *Handler) users(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.create(w, r)
	case http.MethodGet:
		h.list(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
	}
}

func (h *Handler) user(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, h.BasePath+"/Users/")
	if id == "" {
		writeError(w, http.StatusNotFound, "notFound", "missing id")
		return
	}
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	switch r.Method {
	case http.MethodGet:
		u, err := h.Store.Get(r.Context(), tenant, id)
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "notFound", "user not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "serverError", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, u)
	case http.MethodDelete:
		if err := h.Store.Delete(r.Context(), tenant, id); err != nil {
			if errors.Is(err, ErrNotFound) {
				writeError(w, http.StatusNotFound, "notFound", "user not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "serverError", err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case http.MethodPut:
		h.replace(w, r, tenant, id)
	case http.MethodPatch:
		h.patch(w, r, tenant, id)
	default:
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
	}
}

// replace implements PUT /Users/{id}: full-replace semantics per RFC 7644 §3.5.1.
// The request body is a complete User resource; the store overwrites the
// stored record.
func (h *Handler) replace(w http.ResponseWriter, r *http.Request, tenant, id string) {
	var in User
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	in.ID = id
	in.TenantID = tenant
	out, err := h.Store.Update(r.Context(), in)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "user not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// PatchOp is the RFC 7644 §3.5.2 PATCH envelope.
type PatchOp struct {
	Schemas    []string         `json:"schemas"`
	Operations []PatchOperation `json:"Operations"`
}

// PatchOperation is a single SCIM PATCH op.
type PatchOperation struct {
	Op    string          `json:"op"`
	Path  string          `json:"path,omitempty"`
	Value json.RawMessage `json:"value,omitempty"`
}

// patch implements PATCH /Users/{id}. Only a small, security-relevant subset
// of ops is supported: Replace/Add for top-level fields that IdPs actually
// send (userName, active, name, emails). Unknown paths return 400 rather
// than silently ignoring — safer default so the IdP surfaces schema drift.
func (h *Handler) patch(w http.ResponseWriter, r *http.Request, tenant, id string) {
	var req PatchOp
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	if !containsSchema(req.Schemas, PatchOpSchema) {
		writeError(w, http.StatusBadRequest, "invalidSyntax",
			"schemas must include "+PatchOpSchema)
		return
	}
	if len(req.Operations) == 0 {
		writeError(w, http.StatusBadRequest, "invalidValue", "Operations required")
		return
	}

	// Load the current resource so we can apply patches without nulling out
	// fields the IdP did not touch (the vulnerability H3 flagged).
	cur, err := h.Store.Get(r.Context(), tenant, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "user not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}

	for _, op := range req.Operations {
		if err := applyPatchOp(&cur, op); err != nil {
			writeError(w, http.StatusBadRequest, "invalidValue", err.Error())
			return
		}
	}
	cur.TenantID = tenant

	out, err := h.Store.Update(r.Context(), cur)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "notFound", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// applyPatchOp applies a single RFC 7644 op to a User. Supported paths are
// documented inline. Unsupported paths return an error rather than silently
// succeeding — failing loud is the safe default for account-lifecycle ops.
func applyPatchOp(u *User, op PatchOperation) error {
	normOp := strings.ToLower(op.Op)
	if normOp != "replace" && normOp != "add" && normOp != "remove" {
		return fmt.Errorf("unsupported op %q", op.Op)
	}

	// Remove is the only op with no Value; validate shape accordingly.
	if normOp != "remove" && len(op.Value) == 0 {
		return fmt.Errorf("op %q requires value", op.Op)
	}

	switch strings.ToLower(op.Path) {
	case "", "username":
		if op.Path == "" {
			// Top-level body patch: {"op":"replace","value":{"active":false,"userName":"x"}}
			var body struct {
				UserName *string   `json:"userName,omitempty"`
				Active   *bool     `json:"active,omitempty"`
				Name     *UserName `json:"name,omitempty"`
				Emails   []Email   `json:"emails,omitempty"`
			}
			if err := json.Unmarshal(op.Value, &body); err != nil {
				return fmt.Errorf("invalid value: %w", err)
			}
			if body.UserName != nil {
				u.UserName = *body.UserName
			}
			if body.Active != nil {
				u.Active = *body.Active
			}
			if body.Name != nil {
				u.Name = *body.Name
			}
			if body.Emails != nil {
				u.Emails = body.Emails
			}
			return nil
		}
		var v string
		if err := json.Unmarshal(op.Value, &v); err != nil {
			return fmt.Errorf("userName must be string: %w", err)
		}
		u.UserName = v
	case "active":
		var v bool
		if err := json.Unmarshal(op.Value, &v); err != nil {
			return fmt.Errorf("active must be bool: %w", err)
		}
		u.Active = v
	case "name":
		var v UserName
		if err := json.Unmarshal(op.Value, &v); err != nil {
			return fmt.Errorf("invalid name: %w", err)
		}
		u.Name = v
	case "emails":
		var v []Email
		if err := json.Unmarshal(op.Value, &v); err != nil {
			return fmt.Errorf("invalid emails: %w", err)
		}
		u.Emails = v
	default:
		return fmt.Errorf("unsupported path %q", op.Path)
	}
	return nil
}

func containsSchema(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	var in User
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	if in.UserName == "" {
		writeError(w, http.StatusBadRequest, "invalidValue", "userName required")
		return
	}
	in.TenantID = tenant
	in.Schemas = []string{UserSchema}
	out, err := h.Store.Create(r.Context(), in)
	if errors.Is(err, ErrConflict) {
		writeError(w, http.StatusConflict, "uniqueness", "userName already exists")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	q := r.URL.Query()
	f := Filter{
		UserNameEq: parseUserNameEq(q.Get("filter")),
		Start:      parseIntDefault(q.Get("startIndex"), 1),
		Count:      parseIntDefault(q.Get("count"), 100),
	}
	users, total, err := h.Store.Search(r.Context(), tenant, f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"schemas":      []string{ListResponseSchema},
		"totalResults": total,
		"startIndex":   f.Start,
		"itemsPerPage": len(users),
		"Resources":    users,
	})
}

// parseUserNameEq extracts the value of `userName eq "..."` from a SCIM
// filter string. Anything else is ignored; the store then returns all users.
func parseUserNameEq(filter string) string {
	f := strings.TrimSpace(filter)
	if f == "" {
		return ""
	}
	lower := strings.ToLower(f)
	// very small parser — handles `userName eq "x"` (case-insensitive)
	const key = "username eq"
	idx := strings.Index(lower, key)
	if idx != 0 {
		return ""
	}
	rest := strings.TrimSpace(f[len(key):])
	rest = strings.Trim(rest, "\"'")
	return rest
}

func parseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return def
	}
	return n
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, scimType, detail string) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"schemas":  []string{ErrorSchema},
		"detail":   detail,
		"scimType": scimType,
		"status":   fmt.Sprintf("%d", status),
	})
}
