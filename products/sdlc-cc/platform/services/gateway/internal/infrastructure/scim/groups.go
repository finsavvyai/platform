// SCIM 2.0 Groups endpoints. Day 23: lift Groups into a real CRUD
// surface so Okta + Azure AD group provisioning works. Only the slice
// of the schema IdPs actually populate (id, displayName, members) is
// on the wire.
package scim

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// GroupSchema is the core SCIM 2.0 Group schema URN.
const GroupSchema = "urn:ietf:params:scim:schemas:core:2.0:Group"

// Group is the trimmed Group resource we expose.
type Group struct {
	Schemas     []string      `json:"schemas"`
	ID          string        `json:"id"`
	DisplayName string        `json:"displayName"`
	Members     []GroupMember `json:"members,omitempty"`
	TenantID    string        `json:"-"`
	Meta        Meta          `json:"meta"`
}

// GroupMember is one user-or-group reference inside a Group.
type GroupMember struct {
	Value   string `json:"value"`           // user id
	Display string `json:"display,omitempty"`
	Type    string `json:"type,omitempty"`  // "User" | "Group"
	Ref     string `json:"$ref,omitempty"`
}

// GroupStore persists SCIM Groups. nil => /Groups disabled.
type GroupStore interface {
	Create(ctx context.Context, g Group) (Group, error)
	Get(ctx context.Context, tenantID, id string) (Group, error)
	Delete(ctx context.Context, tenantID, id string) error
	Update(ctx context.Context, g Group) (Group, error)
	Search(ctx context.Context, tenantID string, filter Filter) ([]Group, int, error)
}

func (h *Handler) groups(w http.ResponseWriter, r *http.Request) {
	if h.GroupStore == nil {
		writeError(w, http.StatusNotImplemented, "notImplemented", "groups disabled")
		return
	}
	switch r.Method {
	case http.MethodPost:
		h.createGroup(w, r)
	case http.MethodGet:
		h.listGroups(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
	}
}

func (h *Handler) group(w http.ResponseWriter, r *http.Request) {
	if h.GroupStore == nil {
		writeError(w, http.StatusNotImplemented, "notImplemented", "groups disabled")
		return
	}
	id := strings.TrimPrefix(r.URL.Path, h.BasePath+"/Groups/")
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
		g, err := h.GroupStore.Get(r.Context(), tenant, id)
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "notFound", "group not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "serverError", err.Error())
			return
		}
		writeJSON(w, http.StatusOK, withGroupETag(w, g))
	case http.MethodDelete:
		if err := h.GroupStore.Delete(r.Context(), tenant, id); err != nil {
			if errors.Is(err, ErrNotFound) {
				writeError(w, http.StatusNotFound, "notFound", "group not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "serverError", err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case http.MethodPut, http.MethodPatch:
		h.replaceGroup(w, r, tenant, id)
	default:
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
	}
}

func (h *Handler) createGroup(w http.ResponseWriter, r *http.Request) {
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	var in Group
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	if in.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "invalidValue", "displayName required")
		return
	}
	in.TenantID = tenant
	in.Schemas = []string{GroupSchema}
	in.Meta.ResourceType = "Group"
	if in.Meta.Created.IsZero() {
		in.Meta.Created = time.Now().UTC()
	}
	in.Meta.LastModified = time.Now().UTC()
	out, err := h.GroupStore.Create(r.Context(), in)
	if errors.Is(err, ErrConflict) {
		writeError(w, http.StatusConflict, "uniqueness", "displayName already exists")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, withGroupETag(w, out))
}

func (h *Handler) listGroups(w http.ResponseWriter, r *http.Request) {
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	q := r.URL.Query()
	f := Filter{
		Start: parseIntDefault(q.Get("startIndex"), 1),
		Count: parseIntDefault(q.Get("count"), 100),
	}
	gs, total, err := h.GroupStore.Search(r.Context(), tenant, f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"schemas":      []string{ListResponseSchema},
		"totalResults": total,
		"startIndex":   f.Start,
		"itemsPerPage": len(gs),
		"Resources":    gs,
	})
}

// replaceGroup handles PUT (full-replace) and PATCH (we accept a
// trimmed surface that matches what Okta/Azure send). ETag concurrency
// applies on both verbs.
func (h *Handler) replaceGroup(w http.ResponseWriter, r *http.Request, tenant, id string) {
	cur, err := h.GroupStore.Get(r.Context(), tenant, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "group not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	if !checkIfMatch(r, cur.Meta.LastModified) {
		writeError(w, http.StatusPreconditionFailed, "preconditionFailed",
			"If-Match version does not match resource")
		return
	}
	var in Group
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	in.ID = id
	in.TenantID = tenant
	in.Meta.LastModified = time.Now().UTC()
	out, err := h.GroupStore.Update(r.Context(), in)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "group not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "serverError", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, withGroupETag(w, out))
}
