package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// ----- scan_output.go --------------------------------------------------------

func TestPrintFindingsTextEmpty(t *testing.T) {
	stdout := captureStdout(t, func() { printFindingsText(nil) })
	if !strings.Contains(stdout, "No findings") {
		t.Fatalf("expected 'No findings': %s", stdout)
	}
}

func TestPrintFindingsTextWithLongTitle(t *testing.T) {
	findings := []interface{}{
		map[string]interface{}{
			"severity": "high", "category": "secrets", "title": strings.Repeat("X", 80),
			"connection_name": "demo",
		},
		"not-a-map", // exercises the !ok branch
	}
	stdout := captureStdout(t, func() { printFindingsText(findings) })
	if !strings.Contains(stdout, "demo") {
		t.Fatalf("table missing connection: %s", stdout)
	}
}

func TestPrintFindingsJSONHappy(t *testing.T) {
	stdout := captureStdout(t, func() {
		printFindingsJSON([]interface{}{map[string]interface{}{"a": 1}})
	})
	var got []map[string]interface{}
	if err := json.Unmarshal([]byte(stdout), &got); err != nil {
		t.Fatalf("output not JSON: %v\n%s", err, stdout)
	}
}

func TestStringFieldHelper(t *testing.T) {
	m := map[string]interface{}{"k": "v", "n": 7}
	if stringField(m, "k") != "v" {
		t.Fatalf("k")
	}
	if stringField(m, "missing") != "" {
		t.Fatalf("missing should be empty")
	}
	if stringField(m, "n") != "" {
		t.Fatalf("non-string should be empty")
	}
}

// ----- scan.go pure helpers --------------------------------------------------

func TestParseScanFlagsRequiresConnection(t *testing.T) {
	if _, err := parseScanFlags([]string{}); err == nil {
		t.Fatal("expected error without --connection")
	}
}

func TestParseScanFlagsRejectsBadSeverity(t *testing.T) {
	_, err := parseScanFlags([]string{"--connection=x", "--severity=bogus"})
	if err == nil || !strings.Contains(err.Error(), "invalid --severity") {
		t.Fatalf("severity error: %v", err)
	}
}

func TestParseScanFlagsRejectsBadFormat(t *testing.T) {
	_, err := parseScanFlags([]string{"--connection=x", "--format=bogus"})
	if err == nil || !strings.Contains(err.Error(), "invalid --format") {
		t.Fatalf("format error: %v", err)
	}
}

func TestParseScanFlagsHappy(t *testing.T) {
	f, err := parseScanFlags([]string{"--connection=demo", "--severity=critical", "--format=json"})
	if err != nil {
		t.Fatal(err)
	}
	if f.connection != "demo" || f.minSeverity != "critical" || f.format != "json" {
		t.Fatalf("flags: %+v", f)
	}
}

func TestBuildProgressBar(t *testing.T) {
	bar := buildProgressBar(50, 10)
	if bar != "#####....." {
		t.Fatalf("50%% bar = %q", bar)
	}
	bar = buildProgressBar(200, 5) // over 100% clamped
	if bar != "#####" {
		t.Fatalf("overflow: %q", bar)
	}
	bar = buildProgressBar(0, 4)
	if bar != "...." {
		t.Fatalf("0%%: %q", bar)
	}
}

func TestPrintProgressWritesToStderr(t *testing.T) {
	stderr := captureStderr(t, func() { printProgress("scanning", 33, "step1") })
	if !strings.Contains(stderr, "33%") || !strings.Contains(stderr, "scanning") {
		t.Fatalf("missing fields: %q", stderr)
	}
}

func TestCountThresholdExceeded(t *testing.T) {
	findings := []interface{}{
		map[string]interface{}{"severity": "low"},
		map[string]interface{}{"severity": "high"},
		"garbage",
	}
	stderr := captureStderr(t, func() {
		if got := countThresholdExceeded(findings, "high"); got != 1 {
			t.Errorf("got %d, want 1", got)
		}
	})
	if !strings.Contains(stderr, "finding") {
		t.Fatalf("missing summary: %s", stderr)
	}

	stderr = captureStderr(t, func() {
		if got := countThresholdExceeded(findings, "critical"); got != 0 {
			t.Errorf("got %d, want 0", got)
		}
	})
	if !strings.Contains(stderr, "No findings") {
		t.Fatalf("missing clean summary: %s", stderr)
	}
}

// ----- scan_http.go ----------------------------------------------------------

func TestStartScanHappy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"run_id":"abc123"}`))
	}))
	defer srv.Close()
	id, err := startScan(t.Context(), srv.URL, "demo")
	if err != nil || id != "abc123" {
		t.Fatalf("start: id=%q err=%v", id, err)
	}
}

func TestStartScanNested(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"data":{"run_id":"nested-1"}}`))
	}))
	defer srv.Close()
	id, err := startScan(t.Context(), srv.URL, "demo")
	if err != nil || id != "nested-1" {
		t.Fatalf("nested: id=%q err=%v", id, err)
	}
}

func TestStartScanServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"oops"}`))
	}))
	defer srv.Close()
	if _, err := startScan(t.Context(), srv.URL, "demo"); err == nil {
		t.Fatal("expected error on 400")
	}
}

func TestStartScanMalformedBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer srv.Close()
	if _, err := startScan(t.Context(), srv.URL, "demo"); err == nil {
		t.Fatal("expected decode error")
	}
}

func TestFetchFindingsSARIFSkips(t *testing.T) {
	got, err := fetchFindings(t.Context(), "http://example.invalid", "x", "r", "sarif")
	if err != nil {
		t.Fatalf("sarif: %v", err)
	}
	if got != nil {
		t.Fatalf("sarif should be nil, got %v", got)
	}
}

func TestFetchFindingsHappy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"findings":[{"severity":"high","title":"t"}]}`))
	}))
	defer srv.Close()
	findings, err := fetchFindings(t.Context(), srv.URL, "demo", "r1", "json")
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("count: %d", len(findings))
	}
}

func TestFetchFindingsEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()
	got, err := fetchFindings(t.Context(), srv.URL, "demo", "r1", "json")
	if err != nil {
		t.Fatalf("empty: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("expected zero: %v", got)
	}
}

func TestPrintFindingsSARIFHappy(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"version":"2.1.0","runs":[]}`))
	}))
	defer srv.Close()
	stdout := captureStdout(t, func() {
		if err := printFindingsSARIF(t.Context(), srv.URL, "demo"); err != nil {
			t.Errorf("sarif: %v", err)
		}
	})
	if !strings.Contains(stdout, "2.1.0") {
		t.Fatalf("missing SARIF version: %s", stdout)
	}
}

func TestOutputFindingsDispatches(t *testing.T) {
	captureStdout(t, func() {
		outputFindings(t.Context(), "http://x", "y", "json", []interface{}{})
		outputFindings(t.Context(), "http://x", "y", "text", []interface{}{})
		// sarif against bad URL — should print error to stderr but not panic.
		outputFindings(t.Context(), "http://127.0.0.1:1", "y", "sarif", nil)
	})
}

// ----- dlp.go ----------------------------------------------------------------

func TestScanFileOrDirSingleFile(t *testing.T) {
	tmp := t.TempDir()
	p := filepath.Join(tmp, "secret.txt")
	if err := os.WriteFile(p, []byte("aws_access_key_id=AKIAIOSFODNN7EXAMPLE\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	scanner := analysis.NewDLPScanner()
	findings, err := scanFileOrDir(scanner, p)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(findings) == 0 {
		t.Fatal("expected findings on file with AWS key")
	}
}

func TestScanFileOrDirDirectory(t *testing.T) {
	tmp := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tmp, "node_modules"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmp, "node_modules", "leaked.txt"), []byte("AKIAIOSFODNN7EXAMPLE\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmp, "good.go"), []byte("package main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	scanner := analysis.NewDLPScanner()
	findings, err := scanFileOrDir(scanner, tmp)
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	for _, f := range findings {
		if strings.Contains(f.File, "node_modules") {
			t.Fatalf("node_modules should be skipped: %+v", f)
		}
	}
}

func TestScanFileOrDirSkipsBigFiles(t *testing.T) {
	tmp := t.TempDir()
	big := filepath.Join(tmp, "big.txt")
	data := make([]byte, (1<<20)+10)
	if err := os.WriteFile(big, data, 0o600); err != nil {
		t.Fatal(err)
	}
	scanner := analysis.NewDLPScanner()
	findings, err := scanFileOrDir(scanner, tmp)
	if err != nil {
		t.Fatalf("walk: %v", err)
	}
	for _, f := range findings {
		if strings.HasSuffix(f.File, "big.txt") {
			t.Fatalf("big.txt should be skipped")
		}
	}
}

func TestScanFileOrDirMissingPath(t *testing.T) {
	scanner := analysis.NewDLPScanner()
	if _, err := scanFileOrDir(scanner, "/this/does/not/exist"); err == nil {
		t.Fatal("expected stat error")
	}
}

func TestPrintDLPFindingsTextNoFindings(t *testing.T) {
	stdout := captureStdout(t, func() { printDLPFindingsText(nil) })
	if !strings.Contains(stdout, "No secrets") {
		t.Fatalf("%s", stdout)
	}
}

func TestPrintDLPFindingsTextSorted(t *testing.T) {
	stdout := captureStdout(t, func() {
		printDLPFindingsText([]analysis.DLPFinding{
			{File: "b.go", Line: 1, Severity: "high", Pattern: "aws", Match: "AKIA…", Confidence: 0.9},
			{File: "a.go", Line: 1, Severity: "low", Pattern: "slack", Match: "xoxb-…", Confidence: 0.7},
			{File: "a.go", Line: 2, Severity: "low", Pattern: "slack", Match: "xoxb-…", Confidence: 0.7},
		})
	})
	if i, j := strings.Index(stdout, "a.go:1"), strings.Index(stdout, "b.go:1"); i < 0 || j < 0 || i > j {
		t.Fatalf("not sorted by file: %s", stdout)
	}
}

func TestShouldFail(t *testing.T) {
	high := []analysis.DLPFinding{{Severity: "high"}}
	low := []analysis.DLPFinding{{Severity: "low"}}
	if !shouldFail(high, "high") {
		t.Fatal("high@high should fail")
	}
	if shouldFail(low, "high") {
		t.Fatal("low<high should pass")
	}
	if shouldFail(high, "none") {
		t.Fatal("none always passes")
	}
}

func TestSeverityRankAnalysis(t *testing.T) {
	if severityRankAnalysis("critical") != 4 {
		t.Fatal("crit")
	}
	if severityRankAnalysis("garbage") != 0 {
		t.Fatal("garbage")
	}
	if severityRankAnalysis("high") != 3 {
		t.Fatal("high")
	}
	if severityRankAnalysis("medium") != 2 {
		t.Fatal("medium")
	}
	if severityRankAnalysis("low") != 1 {
		t.Fatal("low")
	}
}

// ----- test_provider.go helpers ----------------------------------------------

func TestBuildTestProviderUnknown(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	if _, err := buildTestProvider("bogus", "", "", "", logger); err == nil {
		t.Fatal("expected unknown platform error")
	}
}

func TestBuildTestProviderBitbucketRequiresUsername(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	if _, err := buildTestProvider("bitbucket", "token", "", "", logger); err == nil {
		t.Fatal("bitbucket without username should error")
	}
}

func TestBuildTestProviderHappy(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	for _, p := range []string{"github", "gitlab"} {
		prov, err := buildTestProvider(p, "tok", "", "", logger)
		if err != nil {
			t.Fatalf("%s: %v", p, err)
		}
		if prov == nil {
			t.Fatalf("%s nil", p)
		}
	}
	prov, err := buildTestProvider("bitbucket", "pw", "user", "", logger)
	if err != nil {
		t.Fatalf("bb: %v", err)
	}
	if prov == nil {
		t.Fatal("bb nil")
	}
}

func TestHasTokenDefaults(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	prov, _ := buildTestProvider("github", "", "", "", logger)
	if hasToken(prov) {
		t.Fatal("github without token should report no token")
	}
	prov2, _ := buildTestProvider("github", "tok", "", "", logger)
	if !hasToken(prov2) {
		t.Fatal("github with token should report token")
	}
}

// ----- helpers ---------------------------------------------------------------

func captureStderr(t *testing.T, fn func()) string {
	t.Helper()
	orig := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w
	done := make(chan struct{})
	var buf bytes.Buffer
	go func() {
		_, _ = io.Copy(&buf, r)
		close(done)
	}()
	fn()
	_ = w.Close()
	os.Stderr = orig
	<-done
	return buf.String()
}
