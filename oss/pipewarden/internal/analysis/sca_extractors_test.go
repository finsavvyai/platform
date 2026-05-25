package analysis

import "testing"

func TestExtractDependenciesFromLogs_NPM(t *testing.T) {
	logs := `
+ express@4.18.0
added 12 packages
+ @types/node@20.11.0
`
	deps := ExtractDependenciesFromLogs(logs)
	want := map[string]string{
		"express":     "4.18.0",
		"@types/node": "20.11.0",
	}
	for name, ver := range want {
		if !depsContain(deps, "npm", name, ver) {
			t.Errorf("missing npm:%s@%s in %v", name, ver, deps)
		}
	}
}

func TestExtractDependenciesFromLogs_PyPI(t *testing.T) {
	logs := `
Collecting requests==2.31.0
Successfully installed urllib3-2.0.7
`
	deps := ExtractDependenciesFromLogs(logs)
	if !depsContain(deps, "PyPI", "requests", "2.31.0") {
		t.Errorf("missing PyPI:requests@2.31.0 in %v", deps)
	}
	if !depsContain(deps, "PyPI", "urllib3", "2.0.7") {
		t.Errorf("missing PyPI:urllib3@2.0.7 in %v", deps)
	}
}

func TestExtractDependenciesFromLogs_RubyGems(t *testing.T) {
	logs := `Successfully installed rails-7.0.0`
	deps := ExtractDependenciesFromLogs(logs)
	if !depsContain(deps, "RubyGems", "rails", "7.0.0") {
		t.Errorf("missing RubyGems:rails@7.0.0 in %v", deps)
	}
}

func TestExtractDependenciesFromLogs_Cargo(t *testing.T) {
	logs := `   Compiling serde v1.0.193`
	deps := ExtractDependenciesFromLogs(logs)
	if !depsContain(deps, "crates.io", "serde", "1.0.193") {
		t.Errorf("missing crates.io:serde@1.0.193 in %v", deps)
	}
}

func TestExtractDependenciesFromLogs_Go(t *testing.T) {
	logs := `go: downloading github.com/foo/bar v1.2.3`
	deps := ExtractDependenciesFromLogs(logs)
	if !depsContain(deps, "Go", "github.com/foo/bar", "1.2.3") {
		t.Errorf("missing Go:github.com/foo/bar@1.2.3 in %v", deps)
	}
}

func TestExtractDependenciesFromLogs_Deduplicates(t *testing.T) {
	logs := `
+ express@4.18.0
+ express@4.18.0
+ express@4.18.0
`
	deps := ExtractDependenciesFromLogs(logs)
	count := 0
	for _, d := range deps {
		if d.Name == "express" && d.Version == "4.18.0" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("expected 1 unique express@4.18.0, got %d", count)
	}
}

func TestExtractDependenciesFromLogs_EmptyInput(t *testing.T) {
	if got := ExtractDependenciesFromLogs(""); got != nil {
		t.Errorf("empty input should yield nil, got %v", got)
	}
}

func TestVulnsToFindings_StampsContextAndCategory(t *testing.T) {
	vulns := []VulnFinding{
		{
			ID:       "CVE-2024-12345",
			Summary:  "RCE via deserialization",
			Severity: SeverityCritical,
			Package:  Dependency{Name: "express", Version: "4.0.0", Ecosystem: "npm"},
		},
	}
	findings := VulnsToFindings("conn-a", "run-99", vulns)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	f := findings[0]
	if f.ConnectionName != "conn-a" || f.RunID != "run-99" {
		t.Errorf("connection/runID not stamped: %+v", f)
	}
	if f.Category != CategoryDependency {
		t.Errorf("category should be dependency, got %q", f.Category)
	}
	if f.Severity != SeverityCritical {
		t.Errorf("severity should pass through, got %q", f.Severity)
	}
}

func depsContain(deps []Dependency, eco, name, ver string) bool {
	for _, d := range deps {
		if d.Ecosystem == eco && d.Name == name && d.Version == ver {
			return true
		}
	}
	return false
}
