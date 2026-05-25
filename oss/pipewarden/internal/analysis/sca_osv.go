package analysis

import (
	"strconv"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/osv"
)

func dependencyEcosystem(ecosystem string) osv.Ecosystem {
	switch ecosystem {
	case "npm":
		return osv.EcoNPM
	case "PyPI":
		return osv.EcoPyPI
	case "Go":
		return osv.EcoGo
	case "Maven":
		return osv.EcoMaven
	case "crates.io":
		return osv.EcoCrates
	case "RubyGems":
		return osv.EcoRubyGems
	case "Packagist":
		return osv.EcoPackagist
	case "NuGet":
		return osv.EcoNuGet
	default:
		return osv.Ecosystem(ecosystem)
	}
}

func vulnsFromOSVResults(deps []Dependency, batches [][]osv.Vulnerability) []VulnFinding {
	var findings []VulnFinding
	for i, vulns := range batches {
		if i >= len(deps) {
			break
		}
		findings = append(findings, vulnsFromOSVPackage(deps[i], vulns)...)
	}
	return findings
}

func vulnsFromOSVPackage(dep Dependency, vulns []osv.Vulnerability) []VulnFinding {
	out := make([]VulnFinding, 0, len(vulns))
	for _, vuln := range vulns {
		refs := make([]string, 0, len(vuln.References))
		for _, r := range vuln.References {
			refs = append(refs, r.URL)
		}
		out = append(out, VulnFinding{
			Package:    dep,
			ID:         vuln.ID,
			Summary:    strings.TrimSpace(firstNonEmpty(vuln.Summary, vuln.Details)),
			Severity:   severityFromOSV(vuln),
			References: refs,
			FixedIn:    fixedVersionFromOSV(vuln),
		})
	}
	return out
}

func severityFromOSV(v osv.Vulnerability) Severity {
	best := 0.0
	for _, s := range v.Severity {
		switch strings.ToUpper(s.Type) {
		case "CVSS_V3", "CVSS_V2":
			if score := parseCVSSScore(s.Score); score > best {
				best = score
			}
		}
	}
	switch {
	case best >= 9.0:
		return SeverityCritical
	case best >= 7.0:
		return SeverityHigh
	case best >= 4.0:
		return SeverityMedium
	case best > 0:
		return SeverityLow
	default:
		return SeverityMedium
	}
}

func parseCVSSScore(raw string) float64 {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0
	}
	if score, err := strconv.ParseFloat(raw, 64); err == nil {
		return score
	}
	if idx := strings.LastIndex(raw, "/"); idx >= 0 {
		if score, err := strconv.ParseFloat(raw[idx+1:], 64); err == nil {
			return score
		}
	}
	return 0
}

func fixedVersionFromOSV(v osv.Vulnerability) string {
	for _, affected := range v.Affected {
		for _, r := range affected.Ranges {
			for _, event := range r.Events {
				if event.Fixed != "" {
					return event.Fixed
				}
			}
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// DedupDependencies removes duplicate ecosystem/name/version tuples.
func DedupDependencies(deps []Dependency) []Dependency {
	seen := map[string]bool{}
	out := make([]Dependency, 0, len(deps))
	for _, d := range deps {
		key := d.Ecosystem + ":" + d.Name + ":" + d.Version
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, d)
	}
	return out
}
