package analysis

import (
	"context"
	"regexp"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/osv"
)

// Dependency represents a package dependency with name and version.
type Dependency struct {
	Name      string
	Version   string
	Ecosystem string // npm, PyPI, Go, Maven, etc.
}

// VulnFinding represents a known CVE/vulnerability for a dependency.
type VulnFinding struct {
	Package    Dependency `json:"package"`
	ID         string     `json:"id"` // CVE or GHSA ID
	Summary    string     `json:"summary"`
	Severity   Severity   `json:"severity"`
	CVSS       float64    `json:"cvss,omitempty"`
	References []string   `json:"references,omitempty"`
	FixedIn    string     `json:"fixed_in,omitempty"`
}

// SCAScanner queries OSV.dev for known vulnerabilities in a dependency list.
type SCAScanner struct {
	scanner *OSVDependencyScanner
}

// NewSCAScanner creates a scanner pointing at OSV.dev.
func NewSCAScanner() *SCAScanner {
	return NewSCAScannerWithClient(osv.NewClient())
}

// NewSCAScannerWithClient wires SCA to a custom OSV client (tests, mirrors).
func NewSCAScannerWithClient(client *osv.Client) *SCAScanner {
	return &SCAScanner{scanner: &OSVDependencyScanner{client: client}}
}

// ScanDependencies queries OSV.dev for vulnerabilities in the given deps.
// Returns one VulnFinding per vulnerability per package.
func (s *SCAScanner) ScanDependencies(ctx context.Context, deps []Dependency) ([]VulnFinding, error) {
	if len(deps) == 0 {
		return nil, nil
	}
	return s.scanner.scanDependencies(ctx, DedupDependencies(deps))
}

// ExtractGoModDependencies parses a go.mod file content into Dependency list.
func ExtractGoModDependencies(content string) []Dependency {
	var deps []Dependency
	re := regexp.MustCompile(`^\s+([\w./\-]+)\s+v([\w.\-+]+)`)
	inRequire := false

	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "require (" {
			inRequire = true
			continue
		}
		if inRequire && trimmed == ")" {
			inRequire = false
			continue
		}
		// single-line require
		if strings.HasPrefix(trimmed, "require ") {
			line = strings.TrimPrefix(trimmed, "require ")
			trimmed = line
		}
		if inRequire || strings.HasPrefix(trimmed, "require ") {
			m := re.FindStringSubmatch(line)
			if len(m) == 3 {
				deps = append(deps, Dependency{
					Name:      m[1],
					Version:   m[2],
					Ecosystem: "Go",
				})
			}
		}
	}
	return deps
}
