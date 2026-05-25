package actions

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// MinimumActVersion is the lowest act release we test against. Earlier
// versions miss --json log support and the secret-file flag we rely on.
const MinimumActVersion = "0.2.60"

// ActBinary returns the absolute path to act on PATH, or an error if it
// is missing. Callers should surface ErrActMissing as an actionable
// install hint rather than a generic exec failure.
func ActBinary() (string, error) {
	path, err := exec.LookPath("act")
	if err != nil {
		return "", ErrActMissing
	}
	return path, nil
}

// ErrActMissing is returned when the act binary cannot be found on PATH.
// The wrapping CLI command should print InstallHint() to the user.
var ErrActMissing = errors.New("act binary not found on PATH")

// InstallHint returns the recommended install command for the host OS.
// We intentionally only suggest the well-known package managers — never
// run an installer ourselves, since that would mutate the user's system.
func InstallHint() string {
	return strings.Join([]string{
		"PushCI workflow execution requires the `act` runtime.",
		"Install it with one of:",
		"  brew install act                       # macOS",
		"  gh extension install nektos/gh-act     # GitHub CLI",
		"  curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash",
		"Then re-run your command.",
	}, "\n")
}

// versionPattern matches act's version string, e.g. "act version 0.2.87".
var versionPattern = regexp.MustCompile(`act version (\d+)\.(\d+)\.(\d+)`)

// Version probes the installed act binary and returns its semantic
// version triple. Returns ErrActMissing if act is absent.
func Version(ctx context.Context) (major, minor, patch int, err error) {
	bin, err := ActBinary()
	if err != nil {
		return 0, 0, 0, err
	}
	out, err := exec.CommandContext(ctx, bin, "--version").CombinedOutput()
	if err != nil {
		return 0, 0, 0, fmt.Errorf("act --version failed: %w", err)
	}
	return parseVersion(string(out))
}

// parseVersion is split out so output_test.go can exercise it without
// shelling out.
func parseVersion(s string) (int, int, int, error) {
	m := versionPattern.FindStringSubmatch(s)
	if len(m) != 4 {
		return 0, 0, 0, fmt.Errorf("could not parse act version from %q", s)
	}
	return atoi(m[1]), atoi(m[2]), atoi(m[3]), nil
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		n = n*10 + int(c-'0')
	}
	return n
}
