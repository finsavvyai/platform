package detect

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// readNpmWorkspaces parses the "workspaces" field from root package.json.
// Supports both the string-array form and the object form.
func readNpmWorkspaces(root string) []string {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil
	}
	// Try string-array form first.
	var flat struct {
		Workspaces []string `json:"workspaces"`
	}
	if err := json.Unmarshal(data, &flat); err == nil && len(flat.Workspaces) > 0 {
		return expandGlobs(root, flat.Workspaces)
	}
	// Fall back to object form.
	var nested struct {
		Workspaces struct {
			Packages []string `json:"packages"`
		} `json:"workspaces"`
	}
	if err := json.Unmarshal(data, &nested); err == nil && len(nested.Workspaces.Packages) > 0 {
		return expandGlobs(root, nested.Workspaces.Packages)
	}
	return nil
}

// expandGlobs resolves workspace glob patterns into concrete directory
// paths relative to the repo root. Missing matches are silently skipped.
func expandGlobs(root string, patterns []string) []string {
	var out []string
	for _, pattern := range patterns {
		matches, _ := filepath.Glob(filepath.Join(root, pattern))
		for _, m := range matches {
			if rel, err := filepath.Rel(root, m); err == nil && rel != "" {
				out = append(out, rel)
			}
		}
	}
	return out
}
