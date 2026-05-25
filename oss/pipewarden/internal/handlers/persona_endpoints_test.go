package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TestPersonaEndpointMatrix exercises every read-API surface that the SPA
// + embed widget hit during normal use, plus the team-admin + policy
// management endpoints. Each persona walks a representative path so the
// full request → handler → JSON-encode cycle is covered.
func TestPersonaEndpointMatrix(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)

	// Seed minimal data so list endpoints exercise their non-empty branches.
	if err := db.InviteMember("ops@pipewarden.io", "admin"); err != nil {
		t.Fatalf("InviteMember: %v", err)
	}
	if err := db.CreatePolicy(storage.PolicyRow{
		ID: "test-policy", Name: "Test Policy", Category: "policy",
		Severity: "high", Pattern: "SECRET",
		Description: "find SECRET", Message: "found",
	}); err != nil {
		t.Fatalf("CreatePolicy: %v", err)
	}
	if err := db.CreateTemplate(storage.TemplateRow{
		ID: "tpl-1", Name: "T1", Destination: "slack",
		Template: "hello {{.Connection}}",
	}); err != nil {
		t.Fatalf("CreateTemplate: %v", err)
	}

	cases := []struct {
		name    string
		handler http.HandlerFunc
		method  string
		path    string
		body    string
		want    int
	}{
		// Solo developer: dashboard + status + analytics.
		{"status", h.Status, "GET", "/api/v1/status", "", 200},
		{"dashboard", h.DashboardOverview, "GET", "/api/v1/dashboard/overview", "", 200},
		{"trends", h.GetTrends, "GET", "/api/v1/analytics/trends", "", 200},
		{"summary", h.GetSummary, "GET", "/api/v1/analytics/summary", "", 200},
		{"top-findings", h.GetTopFindings, "GET", "/api/v1/analytics/top-findings", "", 200},
		{"providers", h.GetProviders, "GET", "/api/v1/providers", "", 200},
		{"providers-status", h.GetProvidersStatus, "GET", "/api/v1/providers/status", "", 200},

		// DevOps engineer: connection + pipeline visibility.
		{"connections", h.ListConnections, "GET", "/api/v1/connections", "", 200},
		{"pipelines", h.ListPipelines, "GET", "/api/v1/pipelines", "", 400},
		{"pipeline-runs", h.ListPipelineRuns, "GET", "/api/v1/pipelines/runs", "", 400},
		{"history", h.ListHistory, "GET", "/api/v1/analysis/history", "", 200},
		{"stats", h.GetStats, "GET", "/api/v1/analysis/stats", "", 200},

		// Security lead: findings + policies + secret lifecycle + compliance.
		{"findings", h.ListFindings, "GET", "/api/v1/analysis/findings", "", 200},
		{"policies", h.ListPolicies, "GET", "/api/v1/policies", "", 200},
		{"custom-policies", h.ListCustomPolicies, "GET", "/api/v1/policies/custom", "", 200},
		{"secrets", h.ListSecretLifecycle, "GET", "/api/v1/secrets", "", 200},
		{"secrets-summary", h.SecretLifecycleSummary, "GET", "/api/v1/secrets/summary", "", 200},

		// Enterprise admin: team + audit + notifications + webhooks.
		{"team-members", h.ListTeamMembers, "GET", "/api/v1/team/members", "", 200},
		{"audit", h.ListAuditLog, "GET", "/api/v1/audit", "", 200},
		{"notifications", h.ListNotifications, "GET", "/api/v1/notifications", "", 200},
		{"notification-count", h.NotificationCount, "GET", "/api/v1/notifications/count", "", 200},
		{"webhook-templates", h.ListWebhookTemplates, "GET", "/api/v1/webhooks/templates", "", 200},

		// First-time visitor: viral + AI discovery surfaces.
		{"llms-txt", h.LLMsTxt, "GET", "/llms.txt", "", 200},
		{"ai-plugin", h.AIPluginManifest, "GET", "/.well-known/ai-plugin.json", "", 200},
		{"security-txt", h.SecurityTxt, "GET", "/.well-known/security.txt", "", 200},
		{"openapi", h.OpenAPIJSON, "GET", "/api/v1/openapi.json", "", 200},
		{"security-audit", h.SecurityAudit, "GET", "/api/v1/security/audit", "", 200},
		{"cost-summary", h.CostSummary, "GET", "/api/v1/cost-summary", "", 200},
		{"badge", h.BadgeSVG, "GET", "/api/v1/badge/demo.svg", "", 200},
		{"og", h.OGCardSVG, "GET", "/api/v1/og/demo.svg", "", 200},
		{"embed-findings", h.EmbedFindings, "GET", "/api/v1/embed/findings", "", 200},
		{"embed-summary", h.EmbedSummary, "GET", "/api/v1/embed/summary", "", 200},
		{"embed-config", h.EmbedConfig, "GET", "/api/v1/embed/config", "", 200},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var w *httptest.ResponseRecorder
			if tc.body != "" {
				w = httptest.NewRecorder()
				req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
				req.Header.Set("Content-Type", "application/json")
				tc.handler(w, req)
			} else {
				w = httptest.NewRecorder()
				req := httptest.NewRequest(tc.method, tc.path, nil)
				tc.handler(w, req)
			}
			if w.Code != tc.want {
				t.Fatalf("%s %s: status=%d (want %d) body=%s", tc.method, tc.path, w.Code, tc.want, w.Body.String())
			}
		})
	}
}

// TestPersonaTeamAdminFlow walks an admin through invite → role update →
// remove. Each step lands in a distinct CRUD handler and proves the
// admin-management surface works end-to-end.
func TestPersonaTeamAdminFlow(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// Invite.
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(`{"email":"new@x.com","role":"member"}`))
	req.Header.Set("Content-Type", "application/json")
	h.InviteTeamMember(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("invite: %d body=%s", w.Code, w.Body.String())
	}

	// Duplicate invite → 409.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(`{"email":"new@x.com","role":"member"}`))
	req.Header.Set("Content-Type", "application/json")
	h.InviteTeamMember(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("dup invite: %d body=%s", w.Code, w.Body.String())
	}

	// Invalid email branch.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(`{"email":"bad","role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	h.InviteTeamMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad email: %d", w.Code)
	}

	// Bad JSON branch.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(`{not-json`))
	req.Header.Set("Content-Type", "application/json")
	h.InviteTeamMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad JSON: %d", w.Code)
	}

	// Invalid role branch.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(`{"email":"x@y.com","role":"god"}`))
	req.Header.Set("Content-Type", "application/json")
	h.InviteTeamMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bad role: %d", w.Code)
	}

	// Update role.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("PUT", "/api/v1/team/members/new@x.com/role", strings.NewReader(`{"role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	h.UpdateTeamMemberRole(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("update role: %d body=%s", w.Code, w.Body.String())
	}

	// Update role unknown member → 404.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("PUT", "/api/v1/team/members/ghost@x.com/role", strings.NewReader(`{"role":"admin"}`))
	req.Header.Set("Content-Type", "application/json")
	h.UpdateTeamMemberRole(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("update role ghost: %d", w.Code)
	}

	// Remove member.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("DELETE", "/api/v1/team/members/new@x.com", nil)
	h.RemoveTeamMember(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("remove: %d body=%s", w.Code, w.Body.String())
	}

	// Remove member missing email → 400.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("DELETE", "/api/v1/team/members/", nil)
	h.RemoveTeamMember(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("remove empty: %d", w.Code)
	}
}

// TestPersonaPolicyCRUD exercises the security-lead policy management flow.
func TestPersonaPolicyCRUD(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// Create.
	create := `{"id":"pol-1","name":"P1","severity":"high","pattern":"SECRET","message":"found","description":"d"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/policies", strings.NewReader(create))
	req.Header.Set("Content-Type", "application/json")
	h.CreatePolicy(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d body=%s", w.Code, w.Body.String())
	}

	// Duplicate create → 409.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/policies", strings.NewReader(create))
	req.Header.Set("Content-Type", "application/json")
	h.CreatePolicy(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("dup create: %d body=%s", w.Code, w.Body.String())
	}

	// Update.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("PUT", "/api/v1/policies/pol-1",
		strings.NewReader(`{"id":"pol-1","name":"P1 updated","severity":"medium","pattern":"S","message":"m","description":"d"}`))
	req.Header.Set("Content-Type", "application/json")
	h.UpdatePolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("update: %d body=%s", w.Code, w.Body.String())
	}

	// Test policy.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/policies/pol-1/test", strings.NewReader(`{"yaml_content":"S"}`))
	req.Header.Set("Content-Type", "application/json")
	h.TestPolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("test policy: %d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if matched, _ := resp["matched"].(bool); !matched {
		t.Fatalf("expected matched=true: %s", w.Body.String())
	}

	// Test policy — non-matching.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/policies/pol-1/test", strings.NewReader(`{"yaml_content":"clean"}`))
	req.Header.Set("Content-Type", "application/json")
	h.TestPolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("test no match: %d", w.Code)
	}

	// Delete.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("DELETE", "/api/v1/policies/pol-1", nil)
	h.DeletePolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: %d body=%s", w.Code, w.Body.String())
	}

	// Delete unknown → 404.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("DELETE", "/api/v1/policies/ghost", nil)
	h.DeletePolicy(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("delete ghost: %d body=%s", w.Code, w.Body.String())
	}
}

// TestPersonaWebhookTemplateFlow covers create + render + listing.
func TestPersonaWebhookTemplateFlow(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// Create.
	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/v1/webhooks/templates",
		strings.NewReader(`{"id":"tpl-2","name":"T2","destination":"slack","template":"hello {{.Connection}}"}`))
	req.Header.Set("Content-Type", "application/json")
	h.CreateWebhookTemplate(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d body=%s", w.Code, w.Body.String())
	}

	// Render.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/webhooks/templates/tpl-2/render", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	h.RenderWebhookTemplate(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("render: %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "github-main") {
		t.Fatalf("rendered output missing connection: %s", w.Body.String())
	}

	// Render unknown ID → 404.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/webhooks/templates/ghost/render", strings.NewReader(`{}`))
	h.RenderWebhookTemplate(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("render ghost: %d body=%s", w.Code, w.Body.String())
	}

	// Render with empty id → 400.
	w = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/webhooks/templates//render", strings.NewReader(`{}`))
	h.RenderWebhookTemplate(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("render empty: %d", w.Code)
	}

	// Validation error branches.
	bad := []struct {
		name string
		body string
	}{
		{"no-id", `{"name":"X","destination":"slack","template":"hi"}`},
		{"no-name", `{"id":"x","destination":"slack","template":"hi"}`},
		{"bad-destination", `{"id":"x","name":"X","destination":"voodoo","template":"hi"}`},
		{"no-template", `{"id":"x","name":"X","destination":"slack"}`},
		{"invalid-tpl", `{"id":"x","name":"X","destination":"slack","template":"{{ .NoCloseBrace"}`},
	}
	for _, b := range bad {
		t.Run(b.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest("POST", "/api/v1/webhooks/templates", strings.NewReader(b.body))
			req.Header.Set("Content-Type", "application/json")
			h.CreateWebhookTemplate(w, req)
			if w.Code != http.StatusBadRequest {
				t.Fatalf("%s: %d body=%s", b.name, w.Code, w.Body.String())
			}
		})
	}
}

// TestValidEmailHelper covers the boundary cases of the email validator.
func TestValidEmailHelper(t *testing.T) {
	good := []string{"a@b.co", "x.y@z.io", "a+b@c.com"}
	bad := []string{"", "no-at", "@no-local", "no-tld@", "a@b.", "a@.b"}
	for _, e := range good {
		if !validEmail(e) {
			t.Fatalf("good rejected: %q", e)
		}
	}
	for _, e := range bad {
		if validEmail(e) {
			t.Fatalf("bad accepted: %q", e)
		}
	}
}

// TestValidRoleHelper covers each role + the empty/garbage case.
func TestValidRoleHelper(t *testing.T) {
	if !validRole("admin") || !validRole("member") || !validRole("viewer") {
		t.Fatal("valid role rejected")
	}
	if validRole("") || validRole("god") {
		t.Fatal("bad role accepted")
	}
}
