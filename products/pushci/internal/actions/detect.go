package actions

import (
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Workflow describes a discovered workflow file.
type Workflow struct {
	// Path is the absolute filesystem path to the workflow YAML.
	Path string
	// RelPath is the path relative to the repository root, e.g.
	// ".github/workflows/ci.yml".
	RelPath string
	// Name is the file name without extension, used as a fallback
	// display name when the YAML doesn't declare its own name.
	Name string
}

// ErrNoWorkflows is returned when DetectWorkflows finds zero matching
// files. Callers can surface this as a friendly "nothing to do" message
// instead of an error.
var ErrNoWorkflows = errors.New("no .github/workflows/*.yml files found")

// DetectWorkflows walks .github/workflows/ inside the given repo root
// and returns every YAML file as a Workflow. The result is sorted by
// RelPath so output is reproducible.
func DetectWorkflows(repoRoot string) ([]Workflow, error) {
	if repoRoot == "" {
		return nil, errors.New("repoRoot is required")
	}
	dir := filepath.Join(repoRoot, ".github", "workflows")
	info, err := os.Stat(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNoWorkflows
		}
		return nil, err
	}
	if !info.IsDir() {
		return nil, ErrNoWorkflows
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var out []Workflow
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !isWorkflowFile(name) {
			continue
		}
		abs := filepath.Join(dir, name)
		rel, _ := filepath.Rel(repoRoot, abs)
		out = append(out, Workflow{
			Path:    abs,
			RelPath: filepath.ToSlash(rel),
			Name:    stripWorkflowExt(name),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].RelPath < out[j].RelPath })
	if len(out) == 0 {
		return nil, ErrNoWorkflows
	}
	return out, nil
}

func isWorkflowFile(name string) bool {
	low := strings.ToLower(name)
	return strings.HasSuffix(low, ".yml") || strings.HasSuffix(low, ".yaml")
}

// stripWorkflowExt removes a trailing .yml or .yaml suffix in a
// case-insensitive way. The original name's casing is preserved for
// the prefix so "UPPERCASE.YML" becomes "UPPERCASE".
func stripWorkflowExt(name string) string {
	low := strings.ToLower(name)
	switch {
	case strings.HasSuffix(low, ".yml"):
		return name[:len(name)-4]
	case strings.HasSuffix(low, ".yaml"):
		return name[:len(name)-5]
	}
	return name
}

// HasWorkflows returns true when DetectWorkflows would find at least one
// file. Used by the dispatcher to decide whether a push should be routed
// through act vs the legacy pushci.yml runner.
func HasWorkflows(repoRoot string) bool {
	wfs, err := DetectWorkflows(repoRoot)
	return err == nil && len(wfs) > 0
}
