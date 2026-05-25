package main

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// prePushHook is the /bin/sh template we drop into .git/hooks/pre-push.
// The first line of the body contains pushciHookSignature — we match on
// that when deciding whether it's safe to overwrite. Hand-written hooks
// stay untouched because they lack the signature. Two escape hatches:
// PUSHCI_SKIP_HOOK=1 and `git push --no-verify`.
const pushciHookSignature = "# PushCI generated"

const prePushHook = `#!/bin/sh
# PushCI generated pre-push hook — runs CI checks before push.
# Skip once: git push --no-verify    Disable: export PUSHCI_SKIP_HOOK=1
[ "${PUSHCI_SKIP_HOOK:-}" = "1" ] && exit 0
if [ -x "./pushci" ]; then PUSHCI="./pushci"
elif command -v pushci >/dev/null 2>&1; then PUSHCI=pushci
else echo "PushCI: pushci not found, skipping checks. Install: npm i -g pushci"; exit 0; fi
echo "PushCI: running checks before push..."
$PUSHCI run
EXIT_CODE=$?
[ $EXIT_CODE -eq 127 ] && { echo "PushCI: binary disappeared mid-run, skipping checks."; exit 0; }
if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "PushCI: checks failed. Push aborted."
  echo "  Skip once: git push --no-verify    Disable: export PUSHCI_SKIP_HOOK=1"
  echo "  Diagnose:  pushci troubleshoot      AI heal: pushci diagnose"
  exit 1
fi
echo "PushCI: all checks passed."
`

// installGitHook writes the PushCI pre-push hook into the repo at root.
// It is idempotent: re-installing over an existing PushCI hook is safe
// (we match via the "# PushCI generated" signature). A hand-written
// user hook is NEVER overwritten — we print guidance and exit cleanly.
//
// Returns true when a hook was written (or was already current), false
// otherwise. The bool lets callers decide how to phrase the success
// message (install vs. already present vs. skipped).
func installGitHook(root string) bool {
	gitDir := filepath.Join(root, ".git")
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		cli.Info("Not a git repo — skipped pre-push hook install")
		return false
	}

	hooksDir := filepath.Join(gitDir, "hooks")
	if err := os.MkdirAll(hooksDir, 0755); err != nil {
		cli.Warn("Could not create hooks dir: " + err.Error())
		return false
	}

	hookPath := filepath.Join(hooksDir, "pre-push")
	if existing, err := os.ReadFile(hookPath); err == nil {
		if !strings.Contains(string(existing), pushciHookSignature) {
			cli.Warn("Custom pre-push hook already exists at .git/hooks/pre-push — leaving it alone")
			cli.Info("Merge the PushCI check into it manually, or move it aside and re-run `pushci install-hooks`")
			return false
		}
		// Existing PushCI hook — safe to refresh in place.
		if err := os.WriteFile(hookPath, []byte(prePushHook), 0755); err != nil {
			cli.Warn("Could not refresh git hook: " + err.Error())
			return false
		}
		cli.Success("Refreshed PushCI pre-push hook")
		return true
	}

	if err := os.WriteFile(hookPath, []byte(prePushHook), 0755); err != nil {
		cli.Warn("Could not install git hook: " + err.Error())
		return false
	}
	cli.Success("Installed PushCI pre-push hook at .git/hooks/pre-push")
	return true
}
