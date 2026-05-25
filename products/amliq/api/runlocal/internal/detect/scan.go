package detect

import (
	"path/filepath"
)

// Scan walks a repo root and returns all detected projects.
func Scan(root string) []Project {
	var projects []Project
	seen := map[string]bool{}

	for _, m := range markers {
		matches := findFiles(root, m.file, 3)
		for _, match := range matches {
			dir := filepath.Dir(match)
			key := string(m.stack) + ":" + dir
			if seen[key] {
				continue
			}
			seen[key] = true
			rel, _ := filepath.Rel(root, dir)
			if rel == "" {
				rel = "."
			}
			p := Project{
				Stack:     m.stack,
				BuildTool: m.tool,
				Dir:       rel,
			}
			p.Framework = detectFramework(root, rel, m.stack)
			projects = append(projects, p)
		}
	}
	return projects
}
