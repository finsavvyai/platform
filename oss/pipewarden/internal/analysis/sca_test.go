package analysis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/osv"
)

func TestExtractGoModDependencies(t *testing.T) {
	content := `module github.com/example/app

go 1.21

require (
	github.com/gorilla/mux v1.8.0
	golang.org/x/net v0.15.0
)

require github.com/some/single v1.0.0
`
	deps := ExtractGoModDependencies(content)
	if len(deps) < 2 {
		t.Errorf("expected at least 2 deps, got %d", len(deps))
	}
	for _, d := range deps {
		if d.Ecosystem != "Go" {
			t.Errorf("expected Go ecosystem, got %s", d.Ecosystem)
		}
		if d.Name == "" || d.Version == "" {
			t.Errorf("expected non-empty name and version, got name=%q version=%q", d.Name, d.Version)
		}
	}
}

func TestScanDependencies_EmptyList(t *testing.T) {
	s := NewSCAScanner()
	findings, err := s.ScanDependencies(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 0 {
		t.Errorf("expected no findings for empty deps, got %d", len(findings))
	}
}

func TestScanDependencies_WithVulns(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"results": []map[string]interface{}{
				{
					"vulns": []map[string]interface{}{
						{
							"id":      "GHSA-xxxx-yyyy-zzzz",
							"summary": "Remote code execution in mux",
							"severity": []map[string]interface{}{
								{"type": "CVSS_V3", "score": "9.8"},
							},
							"references": []map[string]interface{}{
								{"url": "https://github.com/advisories/GHSA-xxxx"},
							},
							"affected": []map[string]interface{}{
								{
									"ranges": []map[string]interface{}{
										{
											"events": []map[string]interface{}{
												{"fixed": "1.8.1"},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	s := NewSCAScannerWithClient(osv.NewClient(osv.WithEndpoint(srv.URL)))
	deps := []Dependency{{Name: "github.com/gorilla/mux", Version: "1.8.0", Ecosystem: "Go"}}
	findings, err := s.ScanDependencies(context.Background(), deps)
	if err != nil {
		t.Fatalf("ScanDependencies: %v", err)
	}

	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	f := findings[0]
	if f.ID != "GHSA-xxxx-yyyy-zzzz" {
		t.Errorf("expected GHSA ID, got %s", f.ID)
	}
	if f.Severity != SeverityCritical {
		t.Errorf("expected critical severity for CVSS 9.8, got %s", f.Severity)
	}
	if f.FixedIn != "1.8.1" {
		t.Errorf("expected FixedIn=1.8.1, got %s", f.FixedIn)
	}
	if f.Package.Name != "github.com/gorilla/mux" {
		t.Errorf("expected package name, got %s", f.Package.Name)
	}
	_ = s // silence unused
}

func TestScanDependencies_NoVulns(t *testing.T) {
	deps := []Dependency{{Name: "github.com/safe/pkg", Version: "1.0.0", Ecosystem: "Go"}}
	findings := vulnsFromOSVResults(deps, [][]osv.Vulnerability{{}})
	if len(findings) != 0 {
		t.Errorf("expected 0 findings, got %d", len(findings))
	}
}

func TestSeverityFromOSV_Levels(t *testing.T) {
	tests := []struct {
		score    string
		expected Severity
	}{
		{"9.8", SeverityCritical},
		{"7.5", SeverityHigh},
		{"5.0", SeverityMedium},
		{"2.0", SeverityLow},
	}
	for _, tt := range tests {
		v := osv.Vulnerability{Severity: []osv.Severity{{Type: "CVSS_V3", Score: tt.score}}}
		got := severityFromOSV(v)
		if got != tt.expected {
			t.Errorf("score=%s: expected %s, got %s", tt.score, tt.expected, got)
		}
	}
}

func TestSeverityFromOSV_NoScore(t *testing.T) {
	got := severityFromOSV(osv.Vulnerability{})
	if got != SeverityMedium {
		t.Errorf("expected SeverityMedium for no score, got %s", got)
	}
}

func TestScanDependencies_APIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer srv.Close()

	s := NewSCAScannerWithClient(osv.NewClient(osv.WithEndpoint(srv.URL)))
	deps := []Dependency{{Name: "example/pkg", Version: "1.0.0", Ecosystem: "Go"}}
	_, err := s.ScanDependencies(context.Background(), deps)
	if err == nil {
		t.Fatal("expected error for OSV API failure")
	}
}
