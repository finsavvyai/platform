package updater

import (
	"strings"
	"testing"
)

// Notice + color helper tests. Kept separate from updater_test.go
// so each file stays focused and under the 200-line cap.

func TestColorize_NoColorReturnsPlain(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")
	t.Setenv("FORCE_COLOR", "")
	got := colorize("1;33", "hello")
	if got != "hello" {
		t.Errorf("NO_COLOR should strip color codes, got %q", got)
	}
}

func TestColorize_ForceColorWrapsWithAnsi(t *testing.T) {
	isolateHome(t)
	t.Setenv("FORCE_COLOR", "1")
	got := colorize("1;33", "hello")
	if !strings.HasPrefix(got, "\x1b[1;33m") || !strings.HasSuffix(got, "\x1b[0m") {
		t.Errorf("FORCE_COLOR should wrap in ANSI codes, got %q", got)
	}
	if !strings.Contains(got, "hello") {
		t.Errorf("wrapped output must contain original text, got %q", got)
	}
}

func TestNoColor_ForceColorOverridesNoColor(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")
	t.Setenv("FORCE_COLOR", "1")
	if noColor() {
		t.Error("FORCE_COLOR should win over NO_COLOR")
	}
}

func TestNoColor_NoColorWinsOverTerminalCheck(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")
	t.Setenv("FORCE_COLOR", "")
	if !noColor() {
		t.Error("NO_COLOR should suppress color even when terminal detection would allow it")
	}
}

func TestFormatNotice_ContainsAllKeyPieces(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")
	out := formatNotice("1.4.0", "1.4.1")
	for _, want := range []string{
		"update available",
		"1.4.0",
		"1.4.1",
		"npm i -g pushci@latest",
		"brew upgrade pushci",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("notice missing %q\n--- notice ---\n%s", want, out)
		}
	}
}

func TestFormatNotice_StripsVPrefixOnDisplay(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")
	out := formatNotice("v1.4.0", "v1.4.1")
	if strings.Contains(out, "v1.4.0") || strings.Contains(out, "v1.4.1") {
		t.Errorf("formatNotice should strip v prefix for display, got:\n%s", out)
	}
}

func TestIsCI_DetectsEachMarker(t *testing.T) {
	cases := []string{"CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI",
		"BUILDKITE", "JENKINS_URL", "TRAVIS", "DRONE", "PUSHCI_RUNNER"}
	for _, marker := range cases {
		t.Run(marker, func(t *testing.T) {
			isolateHome(t)
			t.Setenv(marker, "true")
			if !isCI() {
				t.Errorf("isCI should return true when %s is set", marker)
			}
		})
	}
}
