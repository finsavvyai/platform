package analysis

import (
	"fmt"
	"os"
	"strings"
)

// runEgressCheck is the wired entrypoint for the heuristic analyzer.
// Returns nil when PIPEWARDEN_EGRESS_BASELINE is unset so existing users
// don't get a flood of findings until they explicitly enable the feature.
//
// Format: PIPEWARDEN_EGRESS_BASELINE="*.mycompany.com,metrics.foo.com,1.2.3.4"
// Wildcard "*.x.com" matches every subdomain. Bare hostnames match exactly.
func runEgressCheck(connection, runID, content string) []Finding {
	raw := os.Getenv("PIPEWARDEN_EGRESS_BASELINE")
	if raw == "" {
		return nil
	}
	allowlist := make([]string, 0)
	for _, s := range strings.Split(raw, ",") {
		s = strings.TrimSpace(s)
		if s != "" {
			allowlist = append(allowlist, s)
		}
	}
	targets := ExtractEgressTargets([]byte(content))
	return EvaluateEgress(connection, runID, targets, EgressBaseline{Allowlist: allowlist})
}

// EgressBaseline names the hosts a pipeline is expected to contact. Hosts
// outside the baseline produce findings; hosts inside it are silent. The
// initial implementation supports an explicit Allowlist; future versions
// can populate it automatically by observing N healthy runs.
//
// Wildcards: a leading "*." matches any subdomain. Bare hostnames match
// exactly. Empty Allowlist = no baseline configured (every external host
// is reported as info-severity; nothing escalates to high).
type EgressBaseline struct {
	Allowlist []string `json:"allowlist"`
}

// EvaluateEgress compares observed egress targets against the baseline
// and returns one Finding per off-baseline host. Severity escalates with
// known-bad indicators; the rest are reported at high severity (matches
// StepSecurity Harden-Runner default for unknown egress).
//
// connection + runID are stamped onto every finding so they can be stored
// + queried alongside findings from other analyzers.
func EvaluateEgress(connection, runID string, observed []EgressTarget, baseline EgressBaseline) []Finding {
	findings := make([]Finding, 0)
	for _, t := range observed {
		if isAllowed(t.Host, baseline.Allowlist) {
			continue
		}
		findings = append(findings, Finding{
			ConnectionName: connection,
			RunID:          runID,
			Severity:       severityForUnknownHost(t.Host),
			Category:       CategoryEgress,
			Title:          fmt.Sprintf("Unexpected egress: %s", t.Host),
			Description:    fmt.Sprintf("Pipeline contacted %s (%d log references) but the host is not in the egress baseline. This is the same class of signal that detected the axios, Trivy, and tj-actions supply-chain attacks.", t.Host, t.Count),
			Remediation:    fmt.Sprintf("Either add %s to the baseline allowlist (if intentional) or investigate the call site. Known-good additions: registry mirrors, telemetry endpoints, internal artifact stores.", t.Host),
			Confidence:     0.85,
			Status:         "open",
		})
	}
	return findings
}

func isAllowed(host string, allowlist []string) bool {
	for _, pat := range allowlist {
		pat = strings.ToLower(strings.TrimSpace(pat))
		if pat == "" {
			continue
		}
		if strings.HasPrefix(pat, "*.") {
			suffix := pat[1:] // ".example.com"
			if strings.HasSuffix(host, suffix) || host == strings.TrimPrefix(suffix, ".") {
				return true
			}
			continue
		}
		if host == pat {
			return true
		}
	}
	return false
}

// severityForUnknownHost escalates findings on indicators commonly seen
// in supply-chain attacks (DGA-style randomly named subdomains, raw IPs,
// known C2 TLDs). Default = high; criticals require multiple signals.
func severityForUnknownHost(host string) Severity {
	if looksLikeRawIP(host) {
		return SeverityCritical // raw IP egress from CI is almost never legitimate
	}
	if looksLikeDGADomain(host) {
		return SeverityCritical
	}
	for _, suspiciousTLD := range []string{".tk", ".ml", ".ga", ".cf", ".gq"} {
		if strings.HasSuffix(host, suspiciousTLD) {
			return SeverityCritical // free TLDs heavily used in C2
		}
	}
	return SeverityHigh
}

func looksLikeRawIP(host string) bool {
	parts := strings.Split(host, ".")
	if len(parts) != 4 {
		return false
	}
	for _, p := range parts {
		if p == "" {
			return false
		}
		for _, ch := range p {
			if ch < '0' || ch > '9' {
				return false
			}
		}
	}
	return true
}

// looksLikeDGADomain heuristic: subdomain length ≥ 16 chars and ≥ 75% of
// chars are letters (DGAs prefer letters; CDN hashes often have hyphens).
// Rough but useful — false positive rate validated against common AWS S3
// virtual-hosted URLs which keep the subdomain ≤ 63 chars but include
// hyphens and digits.
func looksLikeDGADomain(host string) bool {
	parts := strings.SplitN(host, ".", 2)
	if len(parts) < 2 || len(parts[0]) < 16 {
		return false
	}
	letters := 0
	for _, ch := range parts[0] {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') {
			letters++
		}
	}
	return float64(letters)/float64(len(parts[0])) > 0.75
}
