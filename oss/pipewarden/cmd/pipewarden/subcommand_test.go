package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanSubcommandBadFlags(t *testing.T) {
	captureStderr(t, func() {
		if got := scanSubcommand([]string{}); got != 2 {
			t.Errorf("missing --connection: got %d, want 2", got)
		}
	})
}

func TestScanSubcommandHappyText(t *testing.T) {
	// Mock pipewarden API: returns run_id and immediate-complete progress.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/api/v1/analysis/run"):
			_, _ = w.Write([]byte(`{"run_id":"r1"}`))
		case strings.Contains(r.URL.Path, "/api/v1/scan/r1/progress"):
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"stage\":\"complete\",\"percent\":100,\"message\":\"done\"}\n\n"))
		case strings.HasSuffix(r.URL.Path, "/api/v1/analysis/findings"):
			_, _ = w.Write([]byte(`{"findings":[]}`))
		}
	}))
	defer srv.Close()

	captureStdout(t, func() {
		captureStderr(t, func() {
			code := scanSubcommand([]string{
				"--connection=demo", "--server=" + srv.URL,
				"--severity=critical", "--format=text",
			})
			if code != 0 {
				t.Errorf("exit code %d, want 0", code)
			}
		})
	})
}

func TestScanSubcommandFlagsFindings(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/api/v1/analysis/run"):
			_, _ = w.Write([]byte(`{"run_id":"r2"}`))
		case strings.Contains(r.URL.Path, "/progress"):
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"stage\":\"complete\",\"percent\":100}\n\n"))
		case strings.HasSuffix(r.URL.Path, "/api/v1/analysis/findings"):
			payload, _ := json.Marshal(map[string]any{
				"findings": []map[string]any{{"severity": "critical", "title": "leak"}},
			})
			_, _ = w.Write(payload)
		}
	}))
	defer srv.Close()

	captureStdout(t, func() {
		captureStderr(t, func() {
			code := scanSubcommand([]string{
				"--connection=demo", "--server=" + srv.URL,
				"--severity=high", "--format=json",
			})
			if code != 1 {
				t.Errorf("exit code with findings=%d, want 1", code)
			}
		})
	})
}

func TestScanSubcommandRunError(t *testing.T) {
	// Bad server URL → runScan returns error → exit 1.
	captureStderr(t, func() {
		code := scanSubcommand([]string{
			"--connection=demo", "--server=http://127.0.0.1:1",
		})
		if code != 1 {
			t.Errorf("network err exit=%d, want 1", code)
		}
	})
}

func TestDLPSubcommandNoPaths(t *testing.T) {
	captureStderr(t, func() {
		if got := dlpSubcommand([]string{}); got != 2 {
			t.Errorf("no paths: got %d, want 2", got)
		}
	})
}

func TestDLPSubcommandPathMissing(t *testing.T) {
	captureStderr(t, func() {
		if got := dlpSubcommand([]string{"/no/such/path"}); got != 2 {
			t.Errorf("missing path: got %d, want 2", got)
		}
	})
}

func TestDLPSubcommandJSONNoFindings(t *testing.T) {
	tmp := t.TempDir()
	clean := filepath.Join(tmp, "clean.go")
	if err := os.WriteFile(clean, []byte("package main\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	stdout := captureStdout(t, func() {
		if got := dlpSubcommand([]string{"--format=json", clean}); got != 0 {
			t.Errorf("clean exit: %d", got)
		}
	})
	if !strings.Contains(stdout, "[]") && !strings.Contains(stdout, "null") {
		t.Fatalf("expected empty JSON: %s", stdout)
	}
}

func TestDLPSubcommandFailOnFinding(t *testing.T) {
	tmp := t.TempDir()
	leaky := filepath.Join(tmp, "leaky.go")
	if err := os.WriteFile(leaky, []byte("const k = \"AKIAIOSFODNN7EXAMPLE\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	captureStdout(t, func() {
		captureStderr(t, func() {
			got := dlpSubcommand([]string{"--fail-on=high", leaky})
			if got != 1 {
				t.Errorf("finding exit: %d, want 1", got)
			}
		})
	})
}

func TestDLPSubcommandNoneSeverityNeverFails(t *testing.T) {
	tmp := t.TempDir()
	leaky := filepath.Join(tmp, "leaky.go")
	if err := os.WriteFile(leaky, []byte("AKIAIOSFODNN7EXAMPLE\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	captureStdout(t, func() {
		got := dlpSubcommand([]string{"--fail-on=none", leaky})
		if got != 0 {
			t.Errorf("none severity exit: %d", got)
		}
	})
}
