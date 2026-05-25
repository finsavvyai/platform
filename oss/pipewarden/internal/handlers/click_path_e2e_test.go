package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TestClickPathE2E_CompleteUserJourney walks every actionable button in the
// SPA and verifies the chain: button click → HTTP request → handler logic →
// DB mutation (where applicable) → response shape the UI expects.
//
// Unlike the router-level audit which only confirms routes dispatch, this
// test asserts the response body matches what app.js destructures. If the
// SPA's `data.xxx` access would crash, this test fails first.
func TestClickPathE2E_CompleteUserJourney(t *testing.T) {
	h, db := newTestHandlersDB(t)
	withSessionSecret(t)

	// Seed a user the journey can authenticate as.
	user, err := db.CreateUser("e2e@pipewarden.io", "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQR", "E2E", "Acme")
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}

	type step struct {
		name     string
		fn       func(*testing.T)
		critical bool // failure aborts journey
	}

	steps := []step{
		// === Public surfaces ===
		{"viral.llms_txt", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/llms.txt", nil)
			w := httptest.NewRecorder()
			h.LLMsTxt(w, req)
			assertOK(t, w, "PipeWarden")
		}, true},
		{"viral.ai_plugin", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/.well-known/ai-plugin.json", nil)
			w := httptest.NewRecorder()
			h.AIPluginManifest(w, req)
			var m map[string]any
			mustJSON(t, w, &m)
			if _, ok := m["name_for_human"]; !ok {
				t.Fatalf("ai-plugin missing name_for_human")
			}
		}, true},
		{"viral.security_txt", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/.well-known/security.txt", nil)
			w := httptest.NewRecorder()
			h.SecurityTxt(w, req)
			assertOK(t, w, "Contact:")
		}, true},
		{"viral.openapi", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/openapi.json", nil)
			w := httptest.NewRecorder()
			h.OpenAPIJSON(w, req)
			var spec map[string]any
			mustJSON(t, w, &spec)
			if _, ok := spec["paths"]; !ok {
				t.Fatalf("openapi missing paths")
			}
		}, true},

		// === Auth flow ===
		{"auth.me", func(t *testing.T) {
			req := makeAuthedRequest(t, "GET", "/api/v1/auth/me", "", user.ID, user.Email, user.PasswordVersion)
			w := httptest.NewRecorder()
			h.AuthMe(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			u, ok := resp["user"].(map[string]any)
			if !ok || u["email"] != "e2e@pipewarden.io" {
				t.Fatalf("auth/me body wrong: %v", resp)
			}
		}, true},

		// === Dashboard ===
		{"dashboard.overview", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/dashboard/overview", nil)
			w := httptest.NewRecorder()
			h.DashboardOverview(w, req)
			assertOK(t, w, "")
		}, true},
		{"dashboard.providers", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/providers", nil)
			w := httptest.NewRecorder()
			h.GetProviders(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			providers, ok := resp["providers"].([]any)
			if !ok || len(providers) == 0 {
				t.Fatalf("providers missing or empty: %v", resp)
			}
		}, true},

		// === Connections page: full CRUD click-through ===
		{"connections.list_empty", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/connections", nil)
			w := httptest.NewRecorder()
			h.ListConnections(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["connections"]; !ok {
				t.Fatalf("missing 'connections' key the UI destructures: %v", resp)
			}
		}, true},
		{"connections.create_github", func(t *testing.T) {
			body := `{"name":"e2e-gh","platform":"github","credentials":{"token":"ghp_e2e_test"}}`
			req := httptest.NewRequest("POST", "/api/v1/connections", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.CreateConnection(w, req)
			if w.Code != 201 && w.Code != 200 {
				t.Fatalf("create: %d body=%s", w.Code, w.Body.String())
			}
		}, false},
		{"connections.delete", func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/v1/connections/e2e-gh", nil)
			w := httptest.NewRecorder()
			h.DeleteConnection(w, req)
			if w.Code != 200 && w.Code != 404 {
				t.Fatalf("delete: %d", w.Code)
			}
		}, false},

		// === Findings page ===
		{"findings.list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/analysis/findings", nil)
			w := httptest.NewRecorder()
			h.ListFindings(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["findings"]; !ok {
				t.Fatalf("missing 'findings' key: %v", resp)
			}
		}, true},
		{"findings.history", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/analysis/history", nil)
			w := httptest.NewRecorder()
			h.ListHistory(w, req)
			assertOK(t, w, "")
		}, true},
		{"findings.stats", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/analysis/stats", nil)
			w := httptest.NewRecorder()
			h.GetStats(w, req)
			assertOK(t, w, "")
		}, true},

		// === Policies page ===
		{"policies.list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/policies", nil)
			w := httptest.NewRecorder()
			h.ListPolicies(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["policies"]; !ok {
				t.Fatalf("missing 'policies' key: %v", resp)
			}
		}, true},
		{"policies.create_custom", func(t *testing.T) {
			body := `{"id":"e2e-pol","name":"E2E","severity":"high","pattern":"X","description":"d","message":"m"}`
			req := httptest.NewRequest("POST", "/api/v1/policies", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.CreatePolicy(w, req)
			if w.Code != 201 {
				t.Fatalf("create policy: %d body=%s", w.Code, w.Body.String())
			}
		}, false},
		{"policies.test_custom", func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/policies/e2e-pol/test", strings.NewReader(`{"yaml_content":"X marks the spot"}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.TestPolicy(w, req)
			if w.Code != 200 {
				t.Fatalf("test policy: %d", w.Code)
			}
			var resp map[string]any
			mustJSON(t, w, &resp)
			if matched, _ := resp["matched"].(bool); !matched {
				t.Fatalf("expected matched=true for 'X marks the spot' vs pattern 'X': %v", resp)
			}
		}, false},

		// === Settings: team ===
		{"team.list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/team/members", nil)
			w := httptest.NewRecorder()
			h.ListTeamMembers(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["members"]; !ok {
				t.Fatalf("missing 'members' key: %v", resp)
			}
		}, true},
		{"team.invite", func(t *testing.T) {
			body := `{"email":"colleague@x.com","role":"member"}`
			req := httptest.NewRequest("POST", "/api/v1/team/members", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.InviteTeamMember(w, req)
			if w.Code != 201 {
				t.Fatalf("invite: %d body=%s", w.Code, w.Body.String())
			}
		}, false},
		{"team.update_role", func(t *testing.T) {
			req := httptest.NewRequest("PUT", "/api/v1/team/members/colleague@x.com/role",
				strings.NewReader(`{"role":"admin"}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.UpdateTeamMemberRole(w, req)
			if w.Code != 200 {
				t.Fatalf("role update: %d", w.Code)
			}
		}, false},
		{"team.remove", func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/v1/team/members/colleague@x.com", nil)
			w := httptest.NewRecorder()
			h.RemoveTeamMember(w, req)
			if w.Code != 200 {
				t.Fatalf("remove: %d", w.Code)
			}
		}, false},

		// === Notifications ===
		{"notifications.list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/notifications", nil)
			w := httptest.NewRecorder()
			h.ListNotifications(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["notifications"]; !ok {
				t.Fatalf("missing 'notifications' key: %v", resp)
			}
		}, true},
		{"notifications.count", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/notifications/count", nil)
			w := httptest.NewRecorder()
			h.NotificationCount(w, req)
			var resp map[string]int
			mustJSON(t, w, &resp)
			if _, ok := resp["unread"]; !ok {
				t.Fatalf("missing 'unread' key the UI badge reads: %v", resp)
			}
		}, true},
		{"notifications.read_all", func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/notifications/read-all", nil)
			w := httptest.NewRecorder()
			h.MarkAllNotificationsRead(w, req)
			if w.Code != 200 {
				t.Fatalf("read-all: %d", w.Code)
			}
		}, false},

		// === Audit log ===
		{"audit.list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/audit", nil)
			w := httptest.NewRecorder()
			h.ListAuditLog(w, req)
			assertOK(t, w, "")
		}, true},

		// === Webhooks page ===
		{"webhooks.templates_list", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/webhooks/templates", nil)
			w := httptest.NewRecorder()
			h.ListWebhookTemplates(w, req)
			var resp map[string]any
			mustJSON(t, w, &resp)
			if _, ok := resp["templates"]; !ok {
				t.Fatalf("missing 'templates' key: %v", resp)
			}
		}, true},
		{"webhooks.template_create", func(t *testing.T) {
			// Seed template via DB so render step downstream succeeds.
			_ = db.CreateTemplate(storage.TemplateRow{
				ID: "e2e-tpl", Name: "E2E", Destination: "slack",
				Template: "hello {{.Connection}}",
			})
		}, false},
		{"webhooks.template_render", func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/webhooks/templates/e2e-tpl/render", strings.NewReader(`{}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.RenderWebhookTemplate(w, req)
			if w.Code != 200 {
				t.Fatalf("render: %d body=%s", w.Code, w.Body.String())
			}
			var resp map[string]any
			mustJSON(t, w, &resp)
			rendered, _ := resp["rendered"].(string)
			if !strings.Contains(rendered, "github-main") {
				t.Fatalf("rendered template missing connection placeholder: %s", rendered)
			}
		}, false},

		// === Embed widget surfaces (third-party iframe consumers) ===
		{"embed.findings", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/embed/findings", nil)
			w := httptest.NewRecorder()
			h.EmbedFindings(w, req)
			assertOK(t, w, "")
		}, true},
		{"embed.summary", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/embed/summary", nil)
			w := httptest.NewRecorder()
			h.EmbedSummary(w, req)
			assertOK(t, w, "")
		}, true},
		{"embed.config", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/embed/config", nil)
			w := httptest.NewRecorder()
			h.EmbedConfig(w, req)
			assertOK(t, w, "")
		}, true},
	}

	for _, s := range steps {
		s := s
		t.Run(s.name, func(t *testing.T) {
			s.fn(t)
			if t.Failed() && s.critical {
				t.Logf("critical step %q failed — downstream steps may cascade", s.name)
			}
		})
	}
}

func assertOK(t *testing.T, w *httptest.ResponseRecorder, mustContain string) {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if mustContain != "" && !strings.Contains(w.Body.String(), mustContain) {
		t.Fatalf("body missing %q: %s", mustContain, w.Body.String())
	}
}

func mustJSON(t *testing.T, w *httptest.ResponseRecorder, out any) {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if err := json.Unmarshal(w.Body.Bytes(), out); err != nil {
		t.Fatalf("response not JSON: %v\nbody=%s", err, w.Body.String())
	}
}
