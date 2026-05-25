package analysis

import (
	"testing"
)

func TestLicenseCheckNpmNoAudit(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Install
    run: npm install
  - name: Build
    run: npm run build
`
	findings := checker.CheckLicenses(content)
	found := false
	for _, f := range findings {
		if f.Title == "License audit step missing for npm dependencies" {
			found = true
		}
	}
	if !found {
		t.Error("expected license audit finding for npm install without npm audit")
	}
}

func TestLicenseCheckNpmWithAudit(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Install
    run: npm install
  - name: License check
    run: npm audit
  - name: Build
    run: npm run build
`
	findings := checker.CheckLicenses(content)
	for _, f := range findings {
		if f.Title == "License audit step missing for npm dependencies" {
			t.Error("should not flag npm audit finding when npm audit is present")
		}
	}
}

func TestLicenseCheckPipNoLicenses(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Install deps
    run: pip install -r requirements.txt
  - name: Run tests
    run: pytest
`
	findings := checker.CheckLicenses(content)
	found := false
	for _, f := range findings {
		if f.Title == "License audit step missing for pip dependencies" {
			found = true
		}
	}
	if !found {
		t.Error("expected license audit finding for pip install without pip-licenses")
	}
}

func TestLicenseCheckKnownCopyleft(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Install ffmpeg
    run: npm install ffmpeg
`
	findings := checker.CheckLicenses(content)
	found := false
	for _, f := range findings {
		if f.Category == "license-compliance" && f.Title == "Known copyleft package detected: ffmpeg" {
			found = true
		}
	}
	if !found {
		t.Error("expected copyleft finding for ffmpeg install")
	}
}

func TestLicenseCheckGPLInPackageName(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Install gpl package
    run: pip install some-gpl-library
`
	findings := checker.CheckLicenses(content)
	found := false
	for _, f := range findings {
		if f.Category == "license-compliance" && containsStr(f.Title, "gpl") {
			found = true
		}
	}
	if !found {
		t.Error("expected copyleft finding for package name containing 'gpl'")
	}
}

func TestLicenseCheckClean(t *testing.T) {
	checker := NewLicenseChecker()
	content := `
steps:
  - name: Build
    run: go build ./...
  - name: Test
    run: go test ./...
`
	findings := checker.CheckLicenses(content)
	// go build/test should not trigger npm or pip findings
	for _, f := range findings {
		if f.Title == "License audit step missing for npm dependencies" {
			t.Error("should not flag npm finding when no npm commands present")
		}
		if f.Title == "License audit step missing for pip dependencies" {
			t.Error("should not flag pip finding when no pip commands present")
		}
	}
}

// containsStr is a helper for test assertions.
func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		func() bool {
			for i := 0; i <= len(s)-len(substr); i++ {
				if s[i:i+len(substr)] == substr {
					return true
				}
			}
			return false
		}())
}
