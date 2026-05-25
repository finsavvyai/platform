package updater

import "os"

// optOutEnv silences the checker entirely. Preferred over config
// files because it's the standard pattern for CI tools.
const optOutEnv = "PUSHCI_NO_UPDATE_CHECK"

// forceEnv bypasses CI / TTY / dev-build skip checks. Useful for
// users debugging their setup and for unit tests that run under
// `go test` with a non-TTY stderr. opt-out always wins.
const forceEnv = "PUSHCI_FORCE_UPDATE_CHECK"

// shouldSkip returns true when the update check must be silent for
// ANY reason: dev build, opt-out env, CI, or non-TTY stderr. The
// force env bypasses CI/TTY/dev-build skips but NOT opt-out.
func shouldSkip(current string) bool {
	if os.Getenv(optOutEnv) == "1" {
		return true
	}
	if os.Getenv(forceEnv) == "1" {
		return false
	}
	return isDevBuild(current) || isCI() || !isTerminal()
}

// isCI returns true when common CI environment markers are set.
func isCI() bool {
	markers := []string{
		"CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "BUILDKITE",
		"JENKINS_URL", "TRAVIS", "DRONE", "PUSHCI_RUNNER",
	}
	for _, m := range markers {
		if os.Getenv(m) != "" {
			return true
		}
	}
	return false
}

// terminalFn is the TTY check shouldSkip / noColor consult. Package-
// level var so tests can swap it to exercise both branches.
var terminalFn = defaultIsTerminal

// defaultIsTerminal reports whether stderr is a real TTY. The updater
// writes its banner to stderr so it can't pollute stdout-based
// pipelines like `pushci status | jq`.
func defaultIsTerminal() bool {
	info, err := os.Stderr.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}

func isTerminal() bool { return terminalFn() }
