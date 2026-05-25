package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

var (
	runLogDir     string
	runLogDirOnce sync.Once
	runLogRoot    string
)

// initRunLogDir picks a per-run directory under <root>/.pushci/logs/<ts>/.
// Called once per `pushci run` invocation. Safe if called multiple times.
func initRunLogDir(root string) {
	runLogDirOnce.Do(func() {
		runLogRoot = root
		ts := time.Now().Format("20060102-150405")
		runLogDir = filepath.Join(root, ".pushci", "logs", ts)
		if err := os.MkdirAll(runLogDir, 0o755); err != nil {
			runLogDir = ""
		}
	})
}

// writeCheckLog persists a failed check's full output and returns a path
// relative to the repo root for display. Returns "" if the write failed.
func writeCheckLog(stage, check, cmd, output string) string {
	if runLogDir == "" {
		return ""
	}
	name := fmt.Sprintf("%s-%s.log", slugify(stage), slugify(check))
	full := filepath.Join(runLogDir, name)
	header := fmt.Sprintf("# stage:   %s\n# check:   %s\n# command: %s\n# time:    %s\n\n",
		stage, check, cmd, time.Now().Format(time.RFC3339))
	if err := os.WriteFile(full, []byte(header+output), 0o644); err != nil {
		return ""
	}
	rel, err := filepath.Rel(runLogRoot, full)
	if err != nil {
		return full
	}
	return rel
}

var slugRe = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func slugify(s string) string {
	s = strings.TrimSpace(s)
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		return "check"
	}
	if len(s) > 40 {
		s = s[:40]
	}
	return s
}
