package ai

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// makeConn returns a minimal Connection fixture.
func makeConn(name string) *integrations.Connection {
	return &integrations.Connection{Name: name, Platform: integrations.PlatformGitHub}
}

// makeRun returns a PipelineRun with the given steps.
func makeRun(id string, steps []integrations.PipelineStep) *integrations.PipelineRun {
	return &integrations.PipelineRun{ID: id, Steps: steps}
}

// step returns a PipelineStep with given name and logURL.
func step(name, logURL string) integrations.PipelineStep {
	return integrations.PipelineStep{Name: name, LogURL: logURL}
}

// ---- NewBooster ----

func TestNewBooster_ReturnsNonNil(t *testing.T) {
	b := NewBooster()
	if b == nil {
		t.Fatal("NewBooster() returned nil")
	}
}

// ---- buildStepText ----

func TestBuildStepText_ConcatenatesAndLowercases(t *testing.T) {
	s := integrations.PipelineStep{Name: "Deploy PROD", LogURL: "https://CI/Log"}
	got := buildStepText(s)
	if !strings.Contains(got, "deploy prod") {
		t.Errorf("expected lowercase name in text, got: %s", got)
	}
	if !strings.Contains(got, "https://ci/log") {
		t.Errorf("expected lowercase logURL in text, got: %s", got)
	}
}

// ---- HasFindings ----

func TestHasFindings_EmptyReturnsFalse(t *testing.T) {
	b := NewBooster()
	if b.HasFindings(nil) {
		t.Error("expected false for nil findings slice")
	}
	if b.HasFindings([]analysis.Finding{}) {
		t.Error("expected false for empty findings slice")
	}
}

func TestHasFindings_NonEmptyReturnsTrue(t *testing.T) {
	b := NewBooster()
	findings := []analysis.Finding{{Title: "something"}}
	if !b.HasFindings(findings) {
		t.Error("expected true for non-empty findings slice")
	}
}

// ---- checkSecrets ----

func TestCheckSecrets_HardcodedPasswordTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	// Matches pattern: password = "something123"
	findings := b.checkSecrets(conn, run, `password="supersecret123"`, "build")
	if len(findings) == 0 {
		t.Fatal("expected secret finding for hardcoded password")
	}
	f := findings[0]
	if f.Severity != analysis.SeverityCritical {
		t.Errorf("expected critical, got %s", f.Severity)
	}
	if f.Category != analysis.CategorySecrets {
		t.Errorf("expected secrets category, got %s", f.Category)
	}
	if f.ConnectionName != "c1" {
		t.Errorf("expected connection c1, got %s", f.ConnectionName)
	}
	if f.RunID != "r1" {
		t.Errorf("expected run r1, got %s", f.RunID)
	}
}

func TestCheckSecrets_AWSKeyTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("aws-conn")
	run := makeRun("run2", nil)
	findings := b.checkSecrets(conn, run, "AKIAIOSFODNN7EXAMPLE123456", "setup")
	if len(findings) == 0 {
		t.Fatal("expected finding for AWS access key")
	}
}

func TestCheckSecrets_GitHubTokenTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("gh")
	run := makeRun("r3", nil)
	// ghp_ prefix with 36 alphanumeric chars
	findings := b.checkSecrets(conn, run, "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij", "checkout")
	if len(findings) == 0 {
		t.Fatal("expected finding for GitHub PAT")
	}
}

func TestCheckSecrets_NoSecretNoFinding(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkSecrets(conn, run, "echo hello world && npm install", "install")
	if len(findings) != 0 {
		t.Errorf("expected no findings, got %d", len(findings))
	}
}

func TestCheckSecrets_OnlyOneBreakPerStep(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	// Two different patterns in the same text — should only produce one finding (break on first match).
	text := `password="abc12345678" AKIAIOSFODNN7EXAMPLE123456`
	findings := b.checkSecrets(conn, run, text, "step")
	if len(findings) != 1 {
		t.Errorf("expected exactly 1 finding (break-on-first), got %d", len(findings))
	}
}

// ---- checkMissingHTTPS ----

func TestCheckMissingHTTPS_HTTPURLTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkMissingHTTPS(conn, run, "curl http://example.com/api", "fetch")
	if len(findings) == 0 {
		t.Fatal("expected finding for http:// URL")
	}
	f := findings[0]
	if f.Severity != analysis.SeverityHigh {
		t.Errorf("expected high severity, got %s", f.Severity)
	}
	if f.Category != analysis.CategoryCrypto {
		t.Errorf("expected crypto category, got %s", f.Category)
	}
}

func TestCheckMissingHTTPS_HTTPSURLNotTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkMissingHTTPS(conn, run, "curl https://example.com/api", "fetch")
	if len(findings) != 0 {
		t.Errorf("expected no findings for https://, got %d", len(findings))
	}
}

func TestCheckMissingHTTPS_NoURLNoFinding(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkMissingHTTPS(conn, run, "go build ./...", "build")
	if len(findings) != 0 {
		t.Errorf("expected no findings, got %d", len(findings))
	}
}

// ---- checkRootUser ----

func TestCheckRootUser_USERRootTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkRootUser(conn, run, "USER root", "docker-build")
	if len(findings) == 0 {
		t.Fatal("expected finding for USER root")
	}
	f := findings[0]
	if f.Severity != analysis.SeverityHigh {
		t.Errorf("expected high, got %s", f.Severity)
	}
	if f.Category != analysis.CategoryAccessControl {
		t.Errorf("expected access-control, got %s", f.Category)
	}
}

func TestCheckRootUser_PrivilegedFlagTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkRootUser(conn, run, "docker run --privileged myimage", "run")
	if len(findings) == 0 {
		t.Fatal("expected finding for --privileged")
	}
}

func TestCheckRootUser_RunAsRootTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkRootUser(conn, run, "run script as root", "deploy")
	if len(findings) == 0 {
		t.Fatal("expected finding for 'run as root'")
	}
}

func TestCheckRootUser_NormalUserNoFinding(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkRootUser(conn, run, "USER appuser && npm start", "app")
	if len(findings) != 0 {
		t.Errorf("expected no findings, got %d", len(findings))
	}
}

// ---- checkVulnPackages ----

func TestCheckVulnPackages_Log4jTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkVulnPackages(conn, run, "log4j:2.14.1 jar", "build")
	if len(findings) == 0 {
		t.Fatal("expected finding for log4j 2.14.x")
	}
	f := findings[0]
	if f.Severity != analysis.SeverityCritical {
		t.Errorf("expected critical, got %s", f.Severity)
	}
	if f.Category != analysis.CategoryDependency {
		t.Errorf("expected dependency, got %s", f.Category)
	}
	if !strings.Contains(f.Title, "CVE-2021-44228") {
		t.Errorf("expected CVE in title, got: %s", f.Title)
	}
}

func TestCheckVulnPackages_LodashTriggered(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkVulnPackages(conn, run, "lodash@4.15.0", "install")
	if len(findings) == 0 {
		t.Fatal("expected finding for lodash 4.15.x")
	}
}

func TestCheckVulnPackages_SafePackagesNoFinding(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := b.checkVulnPackages(conn, run, "lodash@4.17.21 react@18.0.0", "install")
	if len(findings) != 0 {
		t.Errorf("expected no findings for safe packages, got %d", len(findings))
	}
}

func TestCheckVulnPackages_MultipleVulnsReturnsMultiple(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	// log4j + express both vulnerable
	text := "log4j:2.14.1 express@2.5.0"
	findings := b.checkVulnPackages(conn, run, text, "build")
	if len(findings) < 2 {
		t.Errorf("expected at least 2 vuln findings, got %d", len(findings))
	}
}

// ---- CheckRun integration ----

func TestCheckRun_EmptyStepsNoFindings(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", []integrations.PipelineStep{})
	findings := b.CheckRun(conn, run)
	if len(findings) != 0 {
		t.Errorf("expected no findings for empty steps, got %d", len(findings))
	}
}

func TestCheckRun_StepWithSecretProducesFindings(t *testing.T) {
	b := NewBooster()
	conn := makeConn("prod")
	run := makeRun("run99", []integrations.PipelineStep{
		step(`set token="secretvalue12345"`, ""),
	})
	findings := b.CheckRun(conn, run)
	if len(findings) == 0 {
		t.Fatal("expected at least one finding")
	}
}

func TestCheckRun_StepWithHTTPURL(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", []integrations.PipelineStep{
		step("fetch data", "http://internal/logs"),
	})
	findings := b.CheckRun(conn, run)
	if len(findings) == 0 {
		t.Fatal("expected finding for http:// in logURL")
	}
}

func TestCheckRun_StepWithRootUser(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", []integrations.PipelineStep{
		step("USER root build", ""),
	})
	findings := b.CheckRun(conn, run)
	if len(findings) == 0 {
		t.Fatal("expected finding for USER root in step name")
	}
}

func TestCheckRun_CleanStepNoFindings(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", []integrations.PipelineStep{
		step("go test ./...", "https://ci.example.com/logs/1"),
		step("go build ./...", "https://ci.example.com/logs/2"),
	})
	findings := b.CheckRun(conn, run)
	if len(findings) != 0 {
		t.Errorf("expected no findings for clean steps, got %d", len(findings))
	}
}

// ---- ToResult ----

func TestToResult_NoFindings_ZeroRiskScore(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	result := b.ToResult(conn, run, nil)
	if result == nil {
		t.Fatal("ToResult returned nil")
	}
	if result.RiskScore != 0 {
		t.Errorf("expected risk score 0, got %d", result.RiskScore)
	}
	if result.Model != "booster-v1" {
		t.Errorf("expected model booster-v1, got %s", result.Model)
	}
	if result.ConnectionName != "c1" {
		t.Errorf("expected connection c1, got %s", result.ConnectionName)
	}
	if result.RunID != "r1" {
		t.Errorf("expected run r1, got %s", result.RunID)
	}
}

func TestToResult_CriticalFindingAdds25(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := []analysis.Finding{
		{Severity: analysis.SeverityCritical},
	}
	result := b.ToResult(conn, run, findings)
	if result.RiskScore != 25 {
		t.Errorf("expected risk score 25 for one critical, got %d", result.RiskScore)
	}
}

func TestToResult_HighFindingAdds15(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := []analysis.Finding{
		{Severity: analysis.SeverityHigh},
	}
	result := b.ToResult(conn, run, findings)
	if result.RiskScore != 15 {
		t.Errorf("expected risk score 15 for one high, got %d", result.RiskScore)
	}
}

func TestToResult_MediumFindingAdds8(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	findings := []analysis.Finding{
		{Severity: analysis.SeverityMedium},
	}
	result := b.ToResult(conn, run, findings)
	if result.RiskScore != 8 {
		t.Errorf("expected risk score 8 for one medium, got %d", result.RiskScore)
	}
}

func TestToResult_RiskScoreCapsAt100(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	// 5 critical = 5*25 = 125; should cap at 100
	findings := []analysis.Finding{
		{Severity: analysis.SeverityCritical},
		{Severity: analysis.SeverityCritical},
		{Severity: analysis.SeverityCritical},
		{Severity: analysis.SeverityCritical},
		{Severity: analysis.SeverityCritical},
	}
	result := b.ToResult(conn, run, findings)
	if result.RiskScore != 100 {
		t.Errorf("expected capped risk score of 100, got %d", result.RiskScore)
	}
}

func TestToResult_LowSeverityNotCounted(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	// Low and Info are not counted in the switch, so score stays 0
	findings := []analysis.Finding{
		{Severity: analysis.SeverityLow},
		{Severity: analysis.SeverityInfo},
	}
	result := b.ToResult(conn, run, findings)
	if result.RiskScore != 0 {
		t.Errorf("expected risk score 0 for low/info only, got %d", result.RiskScore)
	}
}

func TestToResult_AnalyzedAtIsNonZero(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	result := b.ToResult(conn, run, nil)
	if result.AnalyzedAt.IsZero() {
		t.Error("expected non-zero AnalyzedAt")
	}
}

func TestToResult_TokensUsedAndDurationAreZero(t *testing.T) {
	b := NewBooster()
	conn := makeConn("c1")
	run := makeRun("r1", nil)
	result := b.ToResult(conn, run, nil)
	if result.TokensUsed != 0 {
		t.Errorf("expected TokensUsed=0, got %d", result.TokensUsed)
	}
	if result.DurationMS != 0 {
		t.Errorf("expected DurationMS=0, got %d", result.DurationMS)
	}
}
