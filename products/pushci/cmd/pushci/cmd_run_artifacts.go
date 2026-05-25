package main

import (
	"os"
	"path/filepath"
)

// artifactEntry is a single build output with its size.
type artifactEntry struct {
	Name      string `json:"name"`
	SizeBytes int64  `json:"size_bytes"`
	Type      string `json:"type"`
}

// knownArtifactDirs maps directory names to artifact types.
// These are the standard output directories for major build
// tools — vite, webpack, next, go, cargo, maven, etc.
var knownArtifactDirs = []struct {
	dir  string
	kind string
}{
	{"dist", "bundle"},
	{"build", "bundle"},
	{".next", "bundle"},
	{"out", "bundle"},
	{"target/release", "binary"},
	{"coverage", "coverage"},
}

// scanArtifacts walks the project root for known build output
// directories and returns their total sizes. Runs after a
// successful pipeline — the results are included in the run
// report so the dashboard can track size changes over time.
func scanArtifacts(root string) []artifactEntry {
	var entries []artifactEntry
	for _, a := range knownArtifactDirs {
		dir := filepath.Join(root, a.dir)
		size := dirSize(dir)
		if size > 0 {
			entries = append(entries, artifactEntry{
				Name:      a.dir,
				SizeBytes: size,
				Type:      a.kind,
			})
		}
	}
	return entries
}

// dirSize returns the total size of all files in a directory.
// Returns 0 if the directory doesn't exist or is empty.
func dirSize(path string) int64 {
	var total int64
	_ = filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		total += info.Size()
		return nil
	})
	return total
}
