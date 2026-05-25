package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestCreateWebhookTemplate(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	body, _ := json.Marshal(storage.TemplateRow{
		ID:          "slack-alert",
		Name:        "Slack Alert",
		Destination: "slack",
		Template:    `{"text":"Finding: {{.Finding.title}} on {{.Connection}}"}`,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateWebhookTemplate(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp storage.TemplateRow
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if resp.ID != "slack-alert" {
		t.Errorf("expected id=slack-alert, got %q", resp.ID)
	}
}

func TestCreateInvalidTemplate(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	body, _ := json.Marshal(storage.TemplateRow{
		ID:          "broken-tmpl",
		Name:        "Broken",
		Destination: "generic",
		Template:    `{{ .Unclosed`,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateWebhookTemplate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRenderTemplate(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	// Create template
	body, _ := json.Marshal(storage.TemplateRow{
		ID:          "render-test",
		Name:        "Render Test",
		Destination: "generic",
		Template:    `Alert: {{index .Finding "title"}} on {{.Connection}}`,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.CreateWebhookTemplate(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", w.Code, w.Body.String())
	}

	// Render
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates/render-test/render", nil)
	w2 := httptest.NewRecorder()
	h.RenderWebhookTemplate(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w2.Code, w2.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w2.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	rendered, ok := resp["rendered"].(string)
	if !ok {
		t.Fatalf("rendered field missing or not string")
	}
	if !strings.Contains(rendered, "Hardcoded secret detected") {
		t.Errorf("expected finding title in rendered output, got: %q", rendered)
	}
}

func TestListTemplates(t *testing.T) {
	h, cleanup := newPolicyTestHandlers(t)
	defer cleanup()

	for _, id := range []string{"tmpl-one", "tmpl-two"} {
		body, _ := json.Marshal(storage.TemplateRow{
			ID:          id,
			Name:        id,
			Destination: "generic",
			Template:    `{{.Connection}}`,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/templates", bytes.NewReader(body))
		w := httptest.NewRecorder()
		h.CreateWebhookTemplate(w, req)
		if w.Code != http.StatusCreated {
			t.Fatalf("create %s failed: %d %s", id, w.Code, w.Body.String())
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/webhooks/templates", nil)
	w := httptest.NewRecorder()
	h.ListWebhookTemplates(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}
	count, ok := resp["count"].(float64)
	if !ok || count < 2 {
		t.Errorf("expected count >= 2, got %v", resp["count"])
	}
}
