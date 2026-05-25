// User mutation handlers (PUT + PATCH) and the small filter parser
// the listUsers endpoint uses. Split off users.go on Day 23 to keep
// both files ≤200 LOC.
package scim

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// replaceUser implements PUT /Users/{id} with If-Match concurrency.
func (h *Handler) replaceUser(w http.ResponseWriter, r *http.Request, tenant, id string) {
	cur, err := h.Store.Get(r.Context(), tenant, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "user not found")
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
	if h.Audit != nil {
		if err := h.Audit(r.Context(), "scim.user.replace", "scim/Users/"+id, tenant); err != nil {
			writeError(w, http.StatusInternalServerError, "serverError", "audit write failed: "+err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, withETag(w, out))
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

// patchUser implements PATCH /Users/{id}. Only a small,
// security-relevant subset of ops is supported. Unknown paths return
// 400 rather than silently ignoring — safer default so the IdP
// surfaces schema drift. ETag concurrency: when the client sends
// If-Match, we reject with 412 on mismatch.
func (h *Handler) patchUser(w http.ResponseWriter, r *http.Request, tenant, id string) {
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

	cur, err := h.Store.Get(r.Context(), tenant, id)
	if errors.Is(err, ErrNotFound) {
		writeError(w, http.StatusNotFound, "notFound", "user not found")
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
	if h.Audit != nil {
		if err := h.Audit(r.Context(), "scim.user.patch", "scim/Users/"+id, tenant); err != nil {
			writeError(w, http.StatusInternalServerError, "serverError", "audit write failed: "+err.Error())
			return
		}
	}
	writeJSON(w, http.StatusOK, withETag(w, out))
}

// applyPatchOp applies one RFC 7644 op to a User.
func applyPatchOp(u *User, op PatchOperation) error {
	normOp := strings.ToLower(op.Op)
	if normOp != "replace" && normOp != "add" && normOp != "remove" {
		return fmt.Errorf("unsupported op %q", op.Op)
	}
	if normOp != "remove" && len(op.Value) == 0 {
		return fmt.Errorf("op %q requires value", op.Op)
	}

	switch strings.ToLower(op.Path) {
	case "", "username":
		if op.Path == "" {
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

