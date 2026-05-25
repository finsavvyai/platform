package detect

import (
	"os"
	"path/filepath"
	"testing"
)

// Shared helpers for the dogfood_*_test.go files. These are small,
// generic, and kept here so each scenario file can stay focused on
// its single assertion.

// writeFile creates parent directories as needed and writes the body
// to a file inside a test's temp dir. The relative path may contain
// forward slashes.
func writeFile(t *testing.T, dir, rel, body string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

// filterStack returns the subset of projects with a given stack.
func filterStack(projects []Project, s Stack) []Project {
	var out []Project
	for _, p := range projects {
		if p.Stack == s {
			out = append(out, p)
		}
	}
	return out
}

// containsPathSegment returns true when any path component equals the
// given segment. Used to check that a project Dir doesn't live under
// a directory that the scanner is supposed to ignore.
func containsPathSegment(path, segment string) bool {
	for _, part := range splitPathAll(path) {
		if part == segment {
			return true
		}
	}
	return false
}

// splitPathAll splits a cleaned filesystem path into its individual
// components. Works on both posix and windows separators because
// filepath.Split is OS-aware.
func splitPathAll(path string) []string {
	var out []string
	for path != "" && path != "." && path != string(filepath.Separator) {
		dir, file := filepath.Split(path)
		if file != "" {
			out = append([]string{file}, out...)
		}
		path = filepath.Clean(dir)
		if path == "." {
			break
		}
	}
	return out
}
