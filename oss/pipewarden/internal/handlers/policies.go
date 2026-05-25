package handlers

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListPolicies handles GET /api/v1/policies
func (h *Handlers) ListPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.db.ListPolicies()
	if err != nil {
		jsonError(w, "failed to list policies", http.StatusInternalServerError)
		return
	}
	if policies == nil {
		policies = []storage.PolicyRow{}
	}
	jsonOK(w, map[string]interface{}{"policies": policies, "count": len(policies)})
}

// CreatePolicy handles POST /api/v1/policies
func (h *Handlers) CreatePolicy(w http.ResponseWriter, r *http.Request) {
	var req storage.PolicyRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := validatePolicy(req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.IsBuiltin = false
	if req.Category == "" {
		req.Category = "policy"
	}
	if err := h.db.CreatePolicy(req); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	created, err := h.db.GetPolicy(req.ID)
	if err != nil {
		jsonError(w, "policy created but could not be retrieved", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// UpdatePolicy handles PUT /api/v1/policies/{id}
func (h *Handlers) UpdatePolicy(w http.ResponseWriter, r *http.Request) {
	id := policyIDFromPath(r.URL.Path)
	if id == "" {
		jsonError(w, "policy id required", http.StatusBadRequest)
		return
	}
	var req storage.PolicyRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := validatePolicy(req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.db.UpdatePolicy(id, req); err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "built-in") {
			jsonError(w, err.Error(), http.StatusNotFound)
			return
		}
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	updated, err := h.db.GetPolicy(id)
	if err != nil {
		jsonError(w, "failed to retrieve updated policy", http.StatusInternalServerError)
		return
	}
	jsonOK(w, updated)
}

// DeletePolicy handles DELETE /api/v1/policies/{id}
func (h *Handlers) DeletePolicy(w http.ResponseWriter, r *http.Request) {
	id := policyIDFromPath(r.URL.Path)
	if id == "" {
		jsonError(w, "policy id required", http.StatusBadRequest)
		return
	}
	if err := h.db.DeletePolicy(id); err != nil {
		code := http.StatusNotFound
		if strings.Contains(err.Error(), "built-in") {
			code = http.StatusForbidden
		}
		jsonError(w, err.Error(), code)
		return
	}
	jsonOK(w, map[string]string{"id": id, "status": "deleted"})
}

// TestPolicy handles POST /api/v1/policies/{id}/test
func (h *Handlers) TestPolicy(w http.ResponseWriter, r *http.Request) {
	id := policyIDFromPath(strings.TrimSuffix(r.URL.Path, "/test"))
	if id == "" {
		jsonError(w, "policy id required", http.StatusBadRequest)
		return
	}
	policy, err := h.db.GetPolicy(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	var req struct {
		YAMLContent string `json:"yaml_content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	re, err := regexp.Compile(policy.Pattern)
	if err != nil {
		jsonError(w, "policy pattern is invalid regex", http.StatusInternalServerError)
		return
	}
	matched := re.MatchString(req.YAMLContent)
	resp := map[string]interface{}{"matched": matched, "policy_id": id}
	if matched {
		resp["finding"] = map[string]interface{}{
			"severity": policy.Severity,
			"category": policy.Category,
			"title":    policy.Name,
			"message":  policy.Message,
		}
	}
	jsonOK(w, resp)
}
