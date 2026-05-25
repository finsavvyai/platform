package analysis

import (
	"context"
	"time"

	"github.com/finsavvyai/pipewarden/internal/osv"
)

// OSVDependencyScanner queries OSV.dev for known vulnerabilities in CI logs
// and manifest snippets surfaced during heuristic analysis.
type OSVDependencyScanner struct {
	client *osv.Client
}

// NewOSVDependencyScanner returns a scanner backed by the public OSV API.
func NewOSVDependencyScanner() *OSVDependencyScanner {
	return &OSVDependencyScanner{client: osv.NewClient()}
}

// ScanContent extracts dependencies from pipeline text and returns findings.
// Network failures are non-fatal: callers receive nil findings and no error.
func (s *OSVDependencyScanner) ScanContent(
	ctx context.Context,
	content, connection, runID string,
) []Finding {
	deps := DedupDependencies(append(
		ExtractDependenciesFromLogs(content),
		ExtractGoModDependencies(content)...,
	))
	if len(deps) == 0 {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	vulns, err := s.scanDependencies(ctx, deps)
	if err != nil {
		return nil
	}
	return VulnsToFindings(connection, runID, vulns)
}

func (s *OSVDependencyScanner) scanDependencies(ctx context.Context, deps []Dependency) ([]VulnFinding, error) {
	queries := make([]osv.PackageQuery, len(deps))
	for i, d := range deps {
		queries[i] = osv.PackageQuery{
			Ecosystem: dependencyEcosystem(d.Ecosystem),
			Name:      d.Name,
			Version:   d.Version,
		}
	}
	batches, err := s.client.QueryBatch(ctx, queries)
	if err != nil {
		return nil, err
	}
	return vulnsFromOSVResults(deps, batches), nil
}
