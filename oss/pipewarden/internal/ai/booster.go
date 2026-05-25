package ai

import (
	"regexp"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// Booster performs instant pattern-matching for known OWASP security issues,
// skipping AI calls entirely when a deterministic match is found.
type Booster struct{}

// NewBooster creates a new pattern-matching booster.
func NewBooster() *Booster {
	return &Booster{}
}

var hardcodedSecretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']`),
	regexp.MustCompile(`(?i)AKIA[0-9A-Z]{16}`),
	regexp.MustCompile(`(?i)ghp_[0-9a-zA-Z]{36}`),
	regexp.MustCompile(`(?i)glpat-[0-9a-zA-Z\-_]{20,}`),
	regexp.MustCompile(`(?i)sk-[0-9a-zA-Z]{32,}`),
	regexp.MustCompile(`(?i)Bearer\s+[0-9a-zA-Z\-_.]{20,}`),
}

var missingHTTPSPattern = regexp.MustCompile(`(?i)http://[a-zA-Z0-9]`)

var rootUserPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)USER\s+root`),
	regexp.MustCompile(`(?i)run\s+.*as\s+root`),
	regexp.MustCompile(`(?i)--privileged`),
}

// knownVulnerable maps package prefixes to vulnerable version patterns.
var knownVulnerable = []struct {
	Pkg     string
	Pattern *regexp.Regexp
	CVE     string
}{
	{"log4j", regexp.MustCompile(`log4j[:-]2\.(0|1[0-6])[\.\-]`), "CVE-2021-44228"},
	{"openssl", regexp.MustCompile(`openssl[/:-](1\.0\.|0\.)`), "CVE-2022-0778"},
	{"spring-core", regexp.MustCompile(`spring-core[:-]5\.[0-2]\.`), "CVE-2022-22965"},
	{"jackson-databind", regexp.MustCompile(`jackson-databind[:-]2\.[0-8]\.`), "CVE-2020-36518"},
	{"lodash", regexp.MustCompile(`lodash[@/:-](3\.|4\.[0-9]\.|4\.1[0-6]\.)`), "CVE-2020-28500"},
	{"express", regexp.MustCompile(`express[@/:-][0-3]\.`), "CVE-2022-24999"},
}

// CheckRun runs all booster pattern checks against a pipeline run.
// Returns findings for any instant matches. If no patterns match,
// the caller should fall through to AI analysis.
func (b *Booster) CheckRun(conn *integrations.Connection, run *integrations.PipelineRun) []analysis.Finding {
	var findings []analysis.Finding

	for _, step := range run.Steps {
		text := buildStepText(step)
		findings = append(findings, b.checkSecrets(conn, run, text, step.Name)...)
		findings = append(findings, b.checkMissingHTTPS(conn, run, text, step.Name)...)
		findings = append(findings, b.checkRootUser(conn, run, text, step.Name)...)
		findings = append(findings, b.checkVulnPackages(conn, run, text, step.Name)...)
	}

	return findings
}

// HasFindings returns true if booster detected any issues, meaning
// AI analysis can be skipped for these specific patterns.
func (b *Booster) HasFindings(findings []analysis.Finding) bool {
	return len(findings) > 0
}

// ToResult wraps booster findings into an AnalysisResult.
func (b *Booster) ToResult(conn *integrations.Connection, run *integrations.PipelineRun, findings []analysis.Finding) *analysis.AnalysisResult {
	riskScore := 0
	for _, f := range findings {
		switch f.Severity {
		case analysis.SeverityCritical:
			riskScore += 25
		case analysis.SeverityHigh:
			riskScore += 15
		case analysis.SeverityMedium:
			riskScore += 8
		}
	}
	if riskScore > 100 {
		riskScore = 100
	}

	return &analysis.AnalysisResult{
		ConnectionName: conn.Name,
		RunID:          run.ID,
		Findings:       findings,
		Summary:        "Instant pattern match: known OWASP issues detected without AI.",
		RiskScore:      riskScore,
		TokensUsed:     0,
		Model:          "booster-v1",
		AnalyzedAt:     time.Now().UTC(),
		DurationMS:     0,
	}
}

func buildStepText(step integrations.PipelineStep) string {
	return strings.ToLower(step.Name + " " + step.LogURL)
}

func (b *Booster) checkSecrets(conn *integrations.Connection, run *integrations.PipelineRun, text, stepName string) []analysis.Finding {
	var findings []analysis.Finding
	for _, pat := range hardcodedSecretPatterns {
		if pat.MatchString(text) {
			findings = append(findings, analysis.Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       analysis.SeverityCritical,
				Category:       analysis.CategorySecrets,
				Title:          "Hardcoded secret detected in step '" + stepName + "'",
				Description:    "A hardcoded secret, API key, or token pattern was found in the pipeline step configuration. Secrets must never be stored in plaintext.",
				Remediation:    "Move secrets to a vault or CI/CD secret manager. Use environment variable references instead of literal values.",
				Confidence:     0.95,
				Status:         "open",
			})
			break
		}
	}
	return findings
}

func (b *Booster) checkMissingHTTPS(conn *integrations.Connection, run *integrations.PipelineRun, text, stepName string) []analysis.Finding {
	if !missingHTTPSPattern.MatchString(text) {
		return nil
	}
	return []analysis.Finding{{
		ConnectionName: conn.Name,
		RunID:          run.ID,
		Severity:       analysis.SeverityHigh,
		Category:       analysis.CategoryCrypto,
		Title:          "Insecure HTTP endpoint in step '" + stepName + "'",
		Description:    "An HTTP (non-HTTPS) URL was detected. Data transmitted over HTTP is vulnerable to interception and tampering.",
		Remediation:    "Replace all HTTP URLs with HTTPS equivalents. Enforce TLS for all external communications.",
		Confidence:     0.90,
		Status:         "open",
	}}
}

func (b *Booster) checkRootUser(conn *integrations.Connection, run *integrations.PipelineRun, text, stepName string) []analysis.Finding {
	for _, pat := range rootUserPatterns {
		if pat.MatchString(text) {
			return []analysis.Finding{{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       analysis.SeverityHigh,
				Category:       analysis.CategoryAccessControl,
				Title:          "Root user in container step '" + stepName + "'",
				Description:    "The pipeline step runs as root or uses --privileged mode. Running containers as root increases the blast radius of any compromise.",
				Remediation:    "Use a non-root user in Dockerfiles (USER appuser). Avoid --privileged flag. Apply least-privilege principles.",
				Confidence:     0.92,
				Status:         "open",
			}}
		}
	}
	return nil
}

func (b *Booster) checkVulnPackages(conn *integrations.Connection, run *integrations.PipelineRun, text, stepName string) []analysis.Finding {
	var findings []analysis.Finding
	for _, vuln := range knownVulnerable {
		if vuln.Pattern.MatchString(text) {
			findings = append(findings, analysis.Finding{
				ConnectionName: conn.Name,
				RunID:          run.ID,
				Severity:       analysis.SeverityCritical,
				Category:       analysis.CategoryDependency,
				Title:          "Known vulnerable package '" + vuln.Pkg + "' (" + vuln.CVE + ") in step '" + stepName + "'",
				Description:    "A known vulnerable version of " + vuln.Pkg + " was detected. This version is affected by " + vuln.CVE + ".",
				Remediation:    "Upgrade " + vuln.Pkg + " to the latest patched version. Run dependency audit and update lockfiles.",
				Confidence:     0.88,
				Status:         "open",
			})
		}
	}
	return findings
}
