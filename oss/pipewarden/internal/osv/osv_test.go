package osv

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQueryReturnsVulnerabilities(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		body, _ := io.ReadAll(r.Body)
		var got map[string]any
		_ = json.Unmarshal(body, &got)
		pkg, _ := got["package"].(map[string]any)
		if pkg["ecosystem"] != "npm" || pkg["name"] != "lodash" {
			t.Errorf("unexpected pkg: %v", pkg)
		}
		if got["version"] != "4.17.20" {
			t.Errorf("unexpected version: %v", got["version"])
		}
		_, _ = w.Write([]byte(`{"vulns":[{"id":"GHSA-xxxx","summary":"prototype pollution","severity":[{"type":"CVSS_V3","score":"7.4"}],"references":[{"url":"https://github.com/advisories/GHSA-xxxx"}]}]}`))
	}))
	defer srv.Close()

	c := NewClient(WithEndpoint(srv.URL))
	vs, err := c.Query(context.Background(), EcoNPM, "lodash", "4.17.20")
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(vs) != 1 || vs[0].ID != "GHSA-xxxx" {
		t.Fatalf("unexpected vulns: %+v", vs)
	}
	if HighestSeverity(vs) != "7.4" {
		t.Errorf("HighestSeverity: %s", HighestSeverity(vs))
	}
}

func TestQueryHandlesEmptyResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"vulns":[]}`))
	}))
	defer srv.Close()

	vs, err := NewClient(WithEndpoint(srv.URL)).Query(context.Background(), EcoGo, "github.com/safe/pkg", "v1.0.0")
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(vs) != 0 {
		t.Errorf("expected empty, got %d", len(vs))
	}
}

func TestQueryPropagatesNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("upstream down"))
	}))
	defer srv.Close()

	_, err := NewClient(WithEndpoint(srv.URL)).Query(context.Background(), EcoPyPI, "requests", "2.0")
	if err == nil || !strings.Contains(err.Error(), "502") {
		t.Fatalf("expected 502 in error, got %v", err)
	}
}

func TestQueryRequiresPackageName(t *testing.T) {
	if _, err := NewClient().Query(context.Background(), EcoNPM, "", "1.0.0"); err == nil {
		t.Fatal("expected error for empty package name")
	}
}
