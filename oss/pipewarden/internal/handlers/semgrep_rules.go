package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

var semgrepValidSeverities = map[string]bool{
	"ERROR": true, "WARNING": true, "INFO": true,
}

var semgrepSlugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9\-_]{0,63}$`)

// ListSemgrepRules handles GET /api/v1/semgrep/rules.
func (h *Handlers) ListSemgrepRules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	rules, err := h.db.ListSemgrepRules()
	if err != nil {
		jsonError(w, "failed to list rules: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if rules == nil {
		rules = []storage.SemgrepRuleRow{}
	}
	jsonOK(w, rules)
}

// CreateSemgrepRule handles POST /api/v1/semgrep/rules.
func (h *Handlers) CreateSemgrepRule(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req storage.SemgrepRuleRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateSemgrepRule(req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.Language == "" {
		req.Language = "yaml"
	}
	if req.Severity == "" {
		req.Severity = "WARNING"
	}
	req.Enabled = true

	if err := h.db.CreateSemgrepRule(req); err != nil {
		jsonError(w, "failed to create rule: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(req)
}

// DeleteSemgrepRule handles DELETE /api/v1/semgrep/rules/{id}.
func (h *Handlers) DeleteSemgrepRule(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/semgrep/rules/")
	id = strings.TrimSuffix(id, "/test")
	if id == "" {
		jsonError(w, "missing rule id", http.StatusBadRequest)
		return
	}
	if err := h.db.DeleteSemgrepRule(id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, err.Error(), http.StatusNotFound)
			return
		}
		jsonError(w, "failed to delete rule: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// TestSemgrepRule handles POST /api/v1/semgrep/rules/{id}/test.
// It runs a lightweight regex match of the rule pattern against provided YAML content.
func (h *Handlers) TestSemgrepRule(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// extract id from path: /api/v1/semgrep/rules/{id}/test
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/semgrep/rules/")
	path = strings.TrimSuffix(path, "/test")
	id := path
	if id == "" {
		jsonError(w, "missing rule id", http.StatusBadRequest)
		return
	}

	rule, err := h.db.GetSemgrepRule(id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, err.Error(), http.StatusNotFound)
			return
		}
		jsonError(w, "failed to fetch rule: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	re, err := regexp.Compile(rule.Pattern)
	if err != nil {
		jsonError(w, "rule pattern is not valid regex: "+err.Error(), http.StatusUnprocessableEntity)
		return
	}

	matched := re.MatchString(req.Content)
	jsonOK(w, map[string]interface{}{
		"matched": matched,
		"rule_id": id,
		"pattern": rule.Pattern,
	})
}

// SemgrepRulesHandler dispatches /api/v1/semgrep/rules and /api/v1/semgrep/rules/{id}/test.
func (h *Handlers) SemgrepRulesHandler(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	switch {
	case path == "/api/v1/semgrep/rules" || path == "/api/v1/semgrep/rules/":
		switch r.Method {
		case http.MethodGet:
			h.ListSemgrepRules(w, r)
		case http.MethodPost:
			h.CreateSemgrepRule(w, r)
		default:
			jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	case strings.HasSuffix(path, "/test"):
		h.TestSemgrepRule(w, r)
	default:
		// /api/v1/semgrep/rules/{id} — only DELETE supported
		h.DeleteSemgrepRule(w, r)
	}
}

func validateSemgrepRule(r storage.SemgrepRuleRow) error {
	if !semgrepSlugRe.MatchString(r.ID) {
		return fmt.Errorf("id must be a lowercase slug (letters, digits, hyphens, underscores)")
	}
	if strings.TrimSpace(r.Pattern) == "" {
		return fmt.Errorf("pattern must not be empty")
	}
	if r.Severity != "" && !semgrepValidSeverities[strings.ToUpper(r.Severity)] {
		return fmt.Errorf("severity must be one of ERROR, WARNING, INFO")
	}
	if strings.TrimSpace(r.Message) == "" {
		return fmt.Errorf("message must not be empty")
	}
	return nil
}
