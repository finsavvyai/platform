// Post-deploy smoke coverage for every public-facing surface a first-time
// visitor (human or AI agent) lands on. Skipped unless -smoke-url is set;
// driven by scripts/deploy.sh in the post-warm phase.
package integration

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestSmoke_LLMsTxt(t *testing.T) {
	code, body := get(t, "/llms.txt")
	if code != http.StatusOK {
		t.Fatalf("llms.txt: %d", code)
	}
	if !strings.Contains(strings.ToLower(body), "pipewarden") {
		t.Fatalf("llms.txt missing brand: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_AIPluginManifest(t *testing.T) {
	code, body := get(t, "/.well-known/ai-plugin.json")
	if code != http.StatusOK {
		t.Fatalf("ai-plugin: %d body=%s", code, body)
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(body), &m); err != nil {
		t.Fatalf("ai-plugin not JSON: %v\nbody=%s", err, body)
	}
	if _, ok := m["name_for_human"]; !ok {
		t.Fatalf("ai-plugin missing name_for_human: %s", body)
	}
}

func TestSmoke_SecurityTxt(t *testing.T) {
	code, body := get(t, "/.well-known/security.txt")
	if code != http.StatusOK {
		t.Fatalf("security.txt: %d", code)
	}
	if !strings.Contains(body, "Contact:") {
		t.Fatalf("security.txt missing Contact: line: %s", body)
	}
}

func TestSmoke_OpenAPISpec(t *testing.T) {
	code, body := get(t, "/api/v1/openapi.json")
	if code != http.StatusOK {
		t.Fatalf("openapi: %d", code)
	}
	var spec map[string]any
	if err := json.Unmarshal([]byte(body), &spec); err != nil {
		t.Fatalf("openapi not JSON: %v", err)
	}
	if _, ok := spec["paths"]; !ok {
		t.Fatalf("openapi missing paths: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_StatusEndpoint(t *testing.T) {
	code, body := get(t, "/api/v1/status")
	if code != http.StatusOK {
		t.Fatalf("status: %d body=%s", code, body)
	}
}

func TestSmoke_SecurityAudit(t *testing.T) {
	code, _ := get(t, "/api/v1/security/audit")
	if code != http.StatusOK {
		t.Fatalf("security audit: %d", code)
	}
}

func TestSmoke_BadgeSVG(t *testing.T) {
	code, body := get(t, "/api/v1/badge/demo.svg")
	if code != http.StatusOK {
		t.Fatalf("badge: %d", code)
	}
	if !strings.Contains(body, "<svg") {
		t.Fatalf("badge not SVG: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_OGCard(t *testing.T) {
	code, body := get(t, "/api/v1/og/demo.svg")
	if code != http.StatusOK {
		t.Fatalf("og: %d", code)
	}
	if !strings.Contains(body, "<svg") {
		t.Fatalf("og not SVG: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_EmbedWidget(t *testing.T) {
	for _, p := range []string{"/api/v1/embed/findings", "/api/v1/embed/summary", "/api/v1/embed/config"} {
		code, _ := get(t, p)
		if code != http.StatusOK {
			t.Fatalf("%s: %d", p, code)
		}
	}
}

func TestSmoke_Providers(t *testing.T) {
	code, body := get(t, "/api/v1/providers")
	if code != http.StatusOK {
		t.Fatalf("providers: %d", code)
	}
	if !strings.Contains(body, "github") {
		t.Fatalf("providers missing github: %s", body)
	}
}

func TestSmoke_Dashboard(t *testing.T) {
	code, body := get(t, "/api/v1/dashboard/overview")
	if code != http.StatusOK {
		t.Fatalf("dashboard overview: %d", code)
	}
	if !strings.Contains(body, "{") {
		t.Fatalf("dashboard not JSON: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_Readiness(t *testing.T) {
	code, _ := get(t, "/readiness")
	if code != http.StatusOK {
		t.Fatalf("readiness: %d", code)
	}
}

func TestSmoke_Metrics(t *testing.T) {
	code, body := get(t, "/metrics")
	if code != http.StatusOK {
		t.Fatalf("metrics: %d", code)
	}
	if !strings.Contains(body, "# HELP") && !strings.Contains(body, "# TYPE") {
		t.Fatalf("metrics not Prometheus format: %s", body[:min(200, len(body))])
	}
}

// TestSmoke_SecurityHeaders verifies the Cloudflare front-line headers
// land on every public response.
func TestSmoke_SecurityHeaders(t *testing.T) {
	if *smokeURL == "" {
		t.Skip("set -smoke-url to run smoke tests")
	}
	url := strings.TrimRight(*smokeURL, "/") + "/health"
	resp, err := client().Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Required by Cloudflare's default response policy plus our middleware.
	// HSTS comes from CF edge, X-CTO + X-Frame from our middleware. Referrer
	// Policy is set by middleware but Cloudflare's edge response normaliser
	// may rewrite or drop it; warn rather than fail.
	required := []string{
		"Strict-Transport-Security",
		"X-Content-Type-Options",
		"X-Frame-Options",
	}
	for _, h := range required {
		if v := resp.Header.Get(h); v == "" {
			t.Errorf("missing required security header %q", h)
		}
	}
	if v := resp.Header.Get("Referrer-Policy"); v == "" {
		t.Logf("note: Referrer-Policy header not present (Cloudflare edge may strip)")
	}
}
