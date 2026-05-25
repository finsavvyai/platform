package analysis

import (
	"testing"
)

func TestCheckRunnerReuse_SelfHosted(t *testing.T) {
	checker := NewRunnerIsolationChecker()
	yaml := `
jobs:
  build:
    runs-on: self-hosted
    steps:
      - run: echo hello
`
	findings := checker.CheckRunnerReuse(yaml)
	if len(findings) == 0 {
		t.Fatal("expected finding for self-hosted runner, got none")
	}
	f := findings[0]
	if f.Severity != SeverityMedium {
		t.Errorf("expected severity medium, got %s", f.Severity)
	}
	if f.Category != "runner-isolation" {
		t.Errorf("expected category runner-isolation, got %s", f.Category)
	}
}

func TestCheckRunnerReuse_CustomLabel(t *testing.T) {
	checker := NewRunnerIsolationChecker()
	yaml := `
jobs:
  build:
    runs-on: [self-hosted, linux, X64]
    steps:
      - run: make build
`
	findings := checker.CheckRunnerReuse(yaml)
	if len(findings) == 0 {
		t.Fatal("expected finding for custom runner label array, got none")
	}
	if findings[0].Severity != SeverityMedium {
		t.Errorf("expected severity medium, got %s", findings[0].Severity)
	}
}

func TestCheckRunnerReuse_Variable(t *testing.T) {
	checker := NewRunnerIsolationChecker()
	yaml := `
jobs:
  test:
    runs-on: ${{ vars.RUNNER_GROUP }}
    steps:
      - run: go test ./...
`
	findings := checker.CheckRunnerReuse(yaml)
	if len(findings) == 0 {
		t.Fatal("expected finding for variable runner, got none")
	}
	if findings[0].Severity != SeverityLow {
		t.Errorf("expected severity low for variable runner, got %s", findings[0].Severity)
	}
}

func TestCheckRunnerReuse_Managed(t *testing.T) {
	checker := NewRunnerIsolationChecker()
	yaml := `
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`
	findings := checker.CheckRunnerReuse(yaml)
	if len(findings) != 0 {
		t.Errorf("expected no findings for ubuntu-latest, got %d", len(findings))
	}
}

func TestCheckRunnerReuse_Windows(t *testing.T) {
	checker := NewRunnerIsolationChecker()
	yaml := `
jobs:
  build:
    runs-on: windows-latest
    steps:
      - run: echo ok
`
	findings := checker.CheckRunnerReuse(yaml)
	if len(findings) != 0 {
		t.Errorf("expected no findings for windows-latest, got %d", len(findings))
	}
}
