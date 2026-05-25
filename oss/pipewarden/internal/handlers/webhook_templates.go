package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"text/template"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TemplateContext is the data available inside webhook notification templates.
type TemplateContext struct {
	Finding    map[string]interface{} `json:"finding"`
	Connection string                 `json:"connection"`
	Timestamp  string                 `json:"timestamp"`
	RiskScore  int                    `json:"risk_score"`
	ServerURL  string                 `json:"server_url"`
}

var validDestinations = map[string]bool{
	"slack": true, "pagerduty": true, "jira": true, "generic": true,
}

// ListWebhookTemplates handles GET /api/v1/webhooks/templates
func (h *Handlers) ListWebhookTemplates(w http.ResponseWriter, r *http.Request) {
	templates, err := h.db.ListTemplates()
	if err != nil {
		jsonError(w, "failed to list templates", http.StatusInternalServerError)
		return
	}
	if templates == nil {
		templates = []storage.TemplateRow{}
	}
	jsonOK(w, map[string]interface{}{"templates": templates, "count": len(templates)})
}

// CreateWebhookTemplate handles POST /api/v1/webhooks/templates
func (h *Handlers) CreateWebhookTemplate(w http.ResponseWriter, r *http.Request) {
	var req storage.TemplateRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := validateTemplate(req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.db.CreateTemplate(req); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	created, err := h.db.GetTemplate(req.ID)
	if err != nil {
		jsonError(w, "template created but could not be retrieved", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(created)
}

// RenderWebhookTemplate handles POST /api/v1/webhooks/templates/{id}/render
func (h *Handlers) RenderWebhookTemplate(w http.ResponseWriter, r *http.Request) {
	id := templateIDFromPath(strings.TrimSuffix(r.URL.Path, "/render"))
	if id == "" {
		jsonError(w, "template id required", http.StatusBadRequest)
		return
	}
	row, err := h.db.GetTemplate(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	tmpl, err := template.New("wh").Parse(row.Template)
	if err != nil {
		jsonError(w, "template parse error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	ctx := sampleTemplateContext()
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, ctx); err != nil {
		jsonError(w, "template render error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{
		"rendered":    buf.String(),
		"template_id": id,
		"context":     ctx,
	})
}

func validateTemplate(t storage.TemplateRow) error {
	if t.ID == "" {
		return &policyValidationError{"id is required"}
	}
	if t.Name == "" {
		return &policyValidationError{"name is required"}
	}
	if t.Destination == "" {
		return &policyValidationError{"destination is required"}
	}
	if !validDestinations[t.Destination] {
		return &policyValidationError{"destination must be one of slack, pagerduty, jira, generic"}
	}
	if t.Template == "" {
		return &policyValidationError{"template is required"}
	}
	if _, err := template.New("").Parse(t.Template); err != nil {
		return &policyValidationError{"template is invalid: " + err.Error()}
	}
	return nil
}

func sampleTemplateContext() TemplateContext {
	return TemplateContext{
		Finding: map[string]interface{}{
			"title":       "Hardcoded secret detected",
			"severity":    "critical",
			"category":    "secrets",
			"description": "A hardcoded AWS key was found in pipeline YAML.",
		},
		Connection: "github-main",
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		RiskScore:  85,
		ServerURL:  "https://pipewarden.com",
	}
}

func templateIDFromPath(path string) string {
	const prefix = "/api/v1/webhooks/templates/"
	path = strings.TrimPrefix(path, prefix)
	parts := strings.SplitN(path, "/", 2)
	return parts[0]
}
