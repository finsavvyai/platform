package mcp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newServerWithStub(handler http.HandlerFunc) (*MCPServer, *httptest.Server) {
	stub := httptest.NewServer(handler)
	return NewMCPServer(stub.URL, "test-key"), stub
}

func TestToolsRegistry(t *testing.T) {
	s := NewMCPServer("http://x", "k")
	tools, err := s.Tools(context.Background())
	if err != nil {
		t.Fatalf("Tools: %v", err)
	}
	want := map[string]bool{
		"pipewarden_scan": true, "pipewarden_findings": true, "pipewarden_connections": true,
		"pipewarden_dlp_scan": true, "pipewarden_policy_check": true, "pipewarden_compliance": true,
	}
	if len(tools) != len(want) {
		t.Fatalf("tools count=%d want %d", len(tools), len(want))
	}
	for _, tool := range tools {
		if !want[tool.Name] {
			t.Fatalf("unexpected tool: %s", tool.Name)
		}
		var schema map[string]interface{}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("tool %s: invalid schema JSON: %v", tool.Name, err)
		}
	}
}

func TestCallToolUnknown(t *testing.T) {
	s := NewMCPServer("http://x", "k")
	_, err := s.CallTool(context.Background(), "nope", json.RawMessage(`{}`))
	if err == nil || !strings.Contains(err.Error(), "unknown tool") {
		t.Fatalf("want unknown tool error, got %v", err)
	}
}

func TestCallToolDispatchesAndForwardsAuth(t *testing.T) {
	var seen struct {
		auth   string
		path   string
		method string
		body   string
	}
	s, stub := newServerWithStub(func(w http.ResponseWriter, r *http.Request) {
		seen.auth = r.Header.Get("Authorization")
		seen.path = r.URL.Path + "?" + r.URL.RawQuery
		seen.method = r.Method
		b, _ := io.ReadAll(r.Body)
		seen.body = string(b)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
	defer stub.Close()

	cases := []struct {
		tool       string
		input      string
		wantPath   string
		wantMeth   string
		wantInBody string
	}{
		{"pipewarden_scan", `{"connection_name":"gh","run_id":"42","analysis_type":"claude"}`, "/api/v1/analysis/run?", "POST", `"connection_name":"gh"`},
		{"pipewarden_findings", `{"connection_name":"gh","severity":"high","status":"open"}`, "/api/v1/analysis/findings?limit=20&connection_name=gh&severity=high&status=open", "GET", ""},
		{"pipewarden_connections", `{"action":"list"}`, "/api/v1/connections?", "GET", ""},
		{"pipewarden_connections", `{"action":"test","connection_name":"gh"}`, "/api/v1/connections/test?", "POST", `"name":"gh"`},
		{"pipewarden_dlp_scan", `{"content":"AKIA..."}`, "/api/v1/dlp/scan?", "POST", `"redact":true`},
		{"pipewarden_policy_check", `{"connection_name":"gh","run_id":"42","policies":["no-secrets"]}`, "/api/v1/policy/evaluate?", "POST", `"no-secrets"`},
		{"pipewarden_compliance", `{"framework":"soc2","connection_name":"gh"}`, "/api/v1/compliance/soc2?connection=gh", "GET", ""},
	}

	for _, tc := range cases {
		seen = struct {
			auth   string
			path   string
			method string
			body   string
		}{}
		out, err := s.CallTool(context.Background(), tc.tool, json.RawMessage(tc.input))
		if err != nil {
			t.Fatalf("%s: %v", tc.tool, err)
		}
		if seen.auth != "Bearer test-key" {
			t.Fatalf("%s: missing auth header: %q", tc.tool, seen.auth)
		}
		if seen.method != tc.wantMeth {
			t.Fatalf("%s: method=%s, want %s", tc.tool, seen.method, tc.wantMeth)
		}
		if !strings.HasPrefix(seen.path, tc.wantPath) {
			t.Fatalf("%s: path=%q, want prefix %q", tc.tool, seen.path, tc.wantPath)
		}
		if tc.wantInBody != "" && !strings.Contains(seen.body, tc.wantInBody) {
			t.Fatalf("%s: body missing %q in %q", tc.tool, tc.wantInBody, seen.body)
		}
		m, ok := out.(map[string]interface{})
		if !ok || m["ok"] != true {
			t.Fatalf("%s: unexpected response: %+v", tc.tool, out)
		}
	}
}

func TestCallToolInvalidJSONReturnsError(t *testing.T) {
	s := NewMCPServer("http://x", "k")
	tools := []string{"pipewarden_scan", "pipewarden_findings", "pipewarden_connections", "pipewarden_dlp_scan", "pipewarden_policy_check", "pipewarden_compliance"}
	for _, name := range tools {
		_, err := s.CallTool(context.Background(), name, json.RawMessage(`not-json`))
		if err == nil {
			t.Fatalf("%s: expected error on bad JSON", name)
		}
	}
}

func TestApiCallPropagatesNon2xx(t *testing.T) {
	s, stub := newServerWithStub(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	})
	defer stub.Close()

	_, err := s.CallTool(context.Background(), "pipewarden_connections", json.RawMessage(`{"action":"list"}`))
	if err == nil || !strings.Contains(err.Error(), "status 500") {
		t.Fatalf("want 500 error, got %v", err)
	}
}
