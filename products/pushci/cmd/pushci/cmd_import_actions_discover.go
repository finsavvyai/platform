package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// discoverActionsWorkflows resolves --input into a sorted list of
// workflow files. Empty input defaults to .github/workflows/. A file
// path returns that single file. A directory path returns every
// *.yml / *.yaml underneath (non-recursive — GitHub Actions itself
// does not recurse into subdirectories).
func discoverActionsWorkflows(input string) ([]string, error) {
	root := input
	if root == "" {
		root = ".github/workflows"
	}
	info, err := os.Stat(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("path not found: %s", root)
		}
		return nil, err
	}
	if !info.IsDir() {
		if !hasYAMLExt(root) {
			return nil, fmt.Errorf("not a YAML file: %s", root)
		}
		return []string{root}, nil
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read dir %s: %w", root, err)
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() || !hasYAMLExt(e.Name()) {
			continue
		}
		files = append(files, filepath.Join(root, e.Name()))
	}
	sort.Strings(files)
	return files, nil
}

func hasYAMLExt(name string) bool {
	lower := strings.ToLower(name)
	return strings.HasSuffix(lower, ".yml") || strings.HasSuffix(lower, ".yaml")
}
