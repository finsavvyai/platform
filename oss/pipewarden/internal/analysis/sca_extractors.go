package analysis

import (
	"fmt"
	"regexp"
	"strings"
)

// installLinePatterns picks dependencies out of common package-manager
// install output as it appears in CI logs. Patterns are intentionally
// narrow: high-precision over high-recall, because false positives on
// dependency findings waste developer time.
//
// Manifest-based extraction (go.mod, package.json, requirements.txt) is
// covered separately by the existing ExtractGoModDependencies + future
// per-ecosystem manifest parsers. This file targets the CI log path
// because PipeWarden providers stream pipeline run output, not source
// trees.
var installLinePatterns = []struct {
	ecosystem string
	pat       *regexp.Regexp
}{
	// npm/pnpm/yarn:  "+ express@4.18.0"  or  "added express@4.18.0"
	// scoped packages: "+ @types/node@20.11.0"
	{"npm", regexp.MustCompile(`(?:^|\s)(?:\+|added|installed)\s+((?:@[a-z0-9._\-]+/)?[a-z0-9][a-z0-9._\-]*)@(\d+\.\d+\.\d+(?:[\w.\-]+)?)`)},
	// pip:  "Successfully installed requests-2.31.0"  or  "Collecting requests==2.31.0"
	{"PyPI", regexp.MustCompile(`(?:Successfully installed|Collecting)\s+([A-Za-z0-9_\-.]+)[-=]+(\d+\.\d+(?:\.\d+)?(?:[\w.\-]+)?)`)},
	// gem install:  "Successfully installed rails-7.0.0"
	{"RubyGems", regexp.MustCompile(`(?i)(?:Successfully installed|installing)\s+([a-z0-9_\-]+)-(\d+\.\d+\.\d+(?:[\w.\-]+)?)`)},
	// cargo:  "Compiling serde v1.0.193"
	{"crates.io", regexp.MustCompile(`Compiling\s+([a-z0-9_\-]+)\s+v(\d+\.\d+\.\d+(?:[\w.\-]+)?)`)},
	// go module download:  "go: downloading github.com/foo/bar v1.2.3"
	{"Go", regexp.MustCompile(`go:\s+(?:added|downloading|upgraded)\s+([A-Za-z0-9./_\-]+)\s+v(\d+\.\d+\.\d+(?:[\w.\-]+)?)`)},
}

// ExtractDependenciesFromLogs parses CI log content and returns the
// deduplicated (ecosystem, name, version) tuples seen in install lines.
// Complements the manifest parsers (ExtractGoModDependencies, etc).
func ExtractDependenciesFromLogs(logs string) []Dependency {
	if logs == "" {
		return nil
	}
	seen := map[string]Dependency{}
	for _, p := range installLinePatterns {
		for _, m := range p.pat.FindAllStringSubmatch(logs, -1) {
			d := Dependency{Ecosystem: p.ecosystem, Name: m[1], Version: m[2]}
			seen[d.Ecosystem+":"+d.Name+":"+d.Version] = d
		}
	}
	out := make([]Dependency, 0, len(seen))
	for _, d := range seen {
		out = append(out, d)
	}
	return out
}

// VulnsToFindings adapts the OSV scan output to the unified Finding type
// so SCA results flow into the same UI/storage/SARIF export path as every
// other analyzer. Stamps connection + run context, picks severity from
// the OSV CVSS, links the OSV vulnerability page in remediation.
func VulnsToFindings(connection, runID string, vulns []VulnFinding) []Finding {
	out := make([]Finding, 0, len(vulns))
	for _, v := range vulns {
		out = append(out, Finding{
			ConnectionName: connection,
			RunID:          runID,
			Severity:       v.Severity,
			Category:       CategoryDependency,
			Title:          fmt.Sprintf("%s in %s@%s (%s)", v.ID, v.Package.Name, v.Package.Version, v.Package.Ecosystem),
			Description:    strings.TrimSpace(v.Summary),
			Remediation:    fmt.Sprintf("Upgrade %s past %s. Details: https://osv.dev/vulnerability/%s", v.Package.Name, v.Package.Version, v.ID),
			Confidence:     0.95,
			Status:         "open",
		})
	}
	return out
}
