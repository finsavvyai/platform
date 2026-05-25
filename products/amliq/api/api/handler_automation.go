package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/automation"
)

type AutomationHandler struct {
	store automation.Store
}

func NewAutomationHandler(store automation.Store) *AutomationHandler {
	return &AutomationHandler{store: store}
}

func (h *AutomationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rules, err := h.store.List(claims.TenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if rules == nil {
		rules = []automation.Rule{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rules": rules, "total": len(rules),
	})
}

func (h *AutomationHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var rule automation.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	rule.TenantID = claims.TenantID
	created, err := h.store.Create(rule)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *AutomationHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	var rule automation.Rule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	rule.ID = id
	rule.TenantID = claims.TenantID
	updated, err := h.store.Update(rule)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *AutomationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := r.PathValue("id")
	if err := h.store.Delete(claims.TenantID, id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
