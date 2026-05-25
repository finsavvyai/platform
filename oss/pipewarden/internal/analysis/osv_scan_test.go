package analysis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/osv"
)

func TestOSVDependencyScanner_ScanContentFindsVuln(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]any{
				{
					"vulns": []map[string]any{
						{
							"id":      "GHSA-xxxx",
							"summary": "prototype pollution",
							"severity": []map[string]any{
								{"type": "CVSS_V3", "score": "7.4"},
							},
						},
					},
				},
			},
		})
	}))
	defer srv.Close()

	scanner := &OSVDependencyScanner{
		client: osv.NewClient(osv.WithEndpoint(srv.URL)),
	}
	logs := "added lodash@4.17.20"
	findings := scanner.ScanContent(context.Background(), logs, "conn", "run-1")
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	if findings[0].Category != CategoryDependency {
		t.Errorf("expected dependency category, got %s", findings[0].Category)
	}
}

func TestOSVDependencyScanner_ScanContentNoDeps(t *testing.T) {
	scanner := NewOSVDependencyScanner()
	if findings := scanner.ScanContent(context.Background(), "no packages here", "c", "r"); len(findings) != 0 {
		t.Fatalf("expected no findings, got %d", len(findings))
	}
}
