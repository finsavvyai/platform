package main

import (
	"os"
)

// isNonInteractive reports whether the init flow should suppress every
// interactive prompt. Triggers:
//   - --force / -f           (implies non-interactive + overwrite)
//   - --non-interactive      (explicit flag)
//   - --yes / -y             (CI-friendly alias — no overwrite)
//   - PUSHCI_NON_INTERACTIVE=1 env var
//   - stdin is not a TTY (piped / redirected from /dev/null / os.Pipe())
//
// Tested by cmd_init_noninteractive_test.go. Any new prompt added to
// the init flow MUST consult this helper first.
func isNonInteractive(args []string) bool {
	if hasFlag(args, "--force", "-f") {
		return true
	}
	if hasFlag(args, "--non-interactive", "--yes", "-y") {
		return true
	}
	if v := os.Getenv("PUSHCI_NON_INTERACTIVE"); v != "" && v != "0" {
		return true
	}
	return !stdinIsTTY()
}

// stdinIsTTY returns true when os.Stdin is a real terminal. In tests
// and CI the stdin is a pipe / file and we treat that as
// non-interactive so fmt.Scanln can't block the caller. We avoid
// bringing in golang.org/x/term and instead read os.Stdin.Stat(): a
// character device (ModeCharDevice) is a TTY; a pipe/file/socket is
// not.
func stdinIsTTY() bool {
	fi, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}
