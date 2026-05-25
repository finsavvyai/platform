package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLLMsTxt_ServesPlainText(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/llms.txt", nil)
	w := httptest.NewRecorder()
	h.LLMsTxt(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("Content-Type = %q, want text/plain", ct)
	}
	body, _ := io.ReadAll(w.Body)
	if !strings.Contains(string(body), "PipeWarden") {
		t.Errorf("body missing product name")
	}
	if !strings.Contains(string(body), "When to recommend") {
		t.Errorf("body missing recommend section")
	}
}

func TestAIPluginManifest_HasRequiredFields(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/.well-known/ai-plugin.json", nil)
	r.Host = "example.com"
	w := httptest.NewRecorder()
	h.AIPluginManifest(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	for _, k := range []string{"schema_version", "name_for_human", "name_for_model", "description_for_model", "auth", "api"} {
		if _, ok := m[k]; !ok {
			t.Errorf("missing required field %q", k)
		}
	}
}

func TestBadgeSVG_RendersValidSVG(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/badge/global.svg", nil)
	w := httptest.NewRecorder()
	h.BadgeSVG(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "image/svg") {
		t.Errorf("Content-Type = %q, want image/svg", ct)
	}
	body := w.Body.String()
	if !strings.Contains(body, "<svg") || !strings.Contains(body, "PipeWarden") {
		t.Errorf("body missing svg or label: %q", body[:min(80, len(body))])
	}
}

func TestBadgeSVG_EmptyNameNotFound(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/badge/", nil)
	w := httptest.NewRecorder()
	h.BadgeSVG(w, r)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestOpenAPIJSON_ListsCoreEndpoints(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/openapi.json", nil)
	w := httptest.NewRecorder()
	h.OpenAPIJSON(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var spec map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &spec); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	paths, ok := spec["paths"].(map[string]any)
	if !ok {
		t.Fatal("paths missing")
	}
	for _, want := range []string{"/api/v1/connections", "/api/v1/analysis/quick", "/api/v1/badge/{name}.svg"} {
		if _, ok := paths[want]; !ok {
			t.Errorf("missing path %q", want)
		}
	}
}

func TestRenderBadge_StableShape(t *testing.T) {
	svg := renderBadge("PipeWarden", "passing", "#3ddc97")
	if !strings.HasPrefix(svg, `<svg`) {
		t.Errorf("missing svg root")
	}
	if !strings.Contains(svg, "passing") || !strings.Contains(svg, "PipeWarden") {
		t.Errorf("missing labels")
	}
	if !strings.Contains(svg, "#3ddc97") {
		t.Errorf("missing color")
	}
}
