package main

import (
	"bytes"
	"context"
	"io"
	"os"
	"os/exec"
	"strings"
)

// verboseMode is set by --verbose / -v on pushci run.
var verboseMode bool

type cmdResult struct {
	passed bool
	output string
}

func runShellCmd(ctx context.Context, dir, command string, env map[string]string) cmdResult {
	if command == "" {
		return cmdResult{passed: true}
	}
	// Run through sh -c so shell features work: cd, &&, pipes,
	// redirects, env var expansion, etc. The old code split by
	// whitespace and ran via exec.Command which silently broke
	// every command that used cd, &&, or pipes — the deploy
	// step would "succeed" because the bare exec failed fast
	// with an empty error that got swallowed.
	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	// Set CI=true like every real CI tool does. This tells test
	// runners (vitest, jest, cypress) to run once and exit instead
	// of entering watch mode, and tells build tools to use CI-
	// optimized defaults. Without this, vitest hangs forever with
	// "Watching for file changes... press q to quit".
	cmd.Env = append(cmd.Env, "CI=true")
	for k, v := range env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	if verboseMode {
		// Stream output live so the user sees progress in real
		// time — critical for slow ops like npm ci or wrangler
		// deploy. Also captures it for the failure summary.
		var buf bytes.Buffer
		cmd.Stdout = io.MultiWriter(os.Stderr, &buf)
		cmd.Stderr = io.MultiWriter(os.Stderr, &buf)
		err := cmd.Run()
		return cmdResult{passed: err == nil, output: buf.String()}
	}
	out, err := cmd.CombinedOutput()
	return cmdResult{passed: err == nil, output: string(out)}
}

func gitBranch(root string) string {
	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

// printRunResults, countFailed, hasFlag, lastLines live in cmd_run_print.go.
