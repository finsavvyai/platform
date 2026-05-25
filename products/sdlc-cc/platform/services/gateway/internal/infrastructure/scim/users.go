// SCIM 2.0 Users HTTP handlers — Create / Read / Search / Delete.
// PUT + PATCH live in users_patch.go. Types live in types.go. ETag
// helpers live in etag.go. Wire-format helpers in helpers.go.
//
// Carved out of the original 438-LOC scim.go on Day 23.
package scim

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)


func (h *Handler) users(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.createUser(w, r)
	case http.MethodGet:
		h.listUsers(w, r)
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
		writeJSON(w, http.StatusOK, withETag(w, u))
	case http.MethodDelete:
		if err := h.Store.Delete(r.Context(), tenant, id); err != nil {
			if errors.Is(err, ErrNotFound) {
				writeError(w, http.StatusNotFound, "notFound", "user not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "serverError", err.Error())
			return
		}
		if h.Audit != nil {
			if err := h.Audit(r.Context(), "scim.user.delete", "scim/Users/"+id, tenant); err != nil {
				writeError(w, http.StatusInternalServerError, "serverError", "audit write failed: "+err.Error())
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	case http.MethodPut:
		h.replaceUser(w, r, tenant, id)
	case http.MethodPatch:
		h.patchUser(w, r, tenant, id)
	default:
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
	}
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
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
	if h.Audit != nil {
		if err := h.Audit(r.Context(), "scim.user.create", "scim/Users/"+out.ID, tenant); err != nil {
			writeError(w, http.StatusInternalServerError, "serverError", "audit write failed: "+err.Error())
			return
		}
	}
	writeJSON(w, http.StatusCreated, withETag(w, out))
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
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
