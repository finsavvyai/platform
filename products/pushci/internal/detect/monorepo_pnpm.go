package detect

import (
	"path/filepath"
	"strings"
)

func resolvePnpmWorkspaces(root string) []string {
	data, err := readFileString(filepath.Join(root, "pnpm-workspace.yaml"))
	if err != nil {
		return nil
	}
	var dirs []string
	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "- ") {
			pattern := strings.Trim(strings.TrimPrefix(line, "- "), `"'`)
			glob := filepath.Join(root, pattern)
			matches, _ := filepath.Glob(glob)
			for _, m := range matches {
				rel, _ := filepath.Rel(root, m)
				if rel != "" {
					dirs = append(dirs, rel)
				}
			}
		}
	}
	return dirs
}
