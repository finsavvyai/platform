package intel

import (
	"os/exec"
	"sort"
	"strings"
)

// GitHotspot tracks how often a file changes (churn).
type GitHotspot struct {
	File    string `json:"file"`
	Changes int    `json:"changes"`
	Authors int    `json:"authors"`
}

// GitHotspots returns the most frequently changed files in git history.
func GitHotspots(root string, limit int) ([]GitHotspot, error) {
	cmd := exec.Command("git", "log", "--format=", "--name-only", "-100")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	counts := map[string]int{}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.TrimSpace(line)
		if f != "" {
			counts[f]++
		}
	}

	var hotspots []GitHotspot
	for file, changes := range counts {
		if changes >= 2 {
			hotspots = append(hotspots, GitHotspot{
				File: file, Changes: changes,
				Authors: countAuthorsForFile(root, file),
			})
		}
	}

	sort.Slice(hotspots, func(i, j int) bool {
		return hotspots[i].Changes > hotspots[j].Changes
	})

	if limit > 0 && len(hotspots) > limit {
		hotspots = hotspots[:limit]
	}
	return hotspots, nil
}

func countAuthorsForFile(root, file string) int {
	cmd := exec.Command("git", "log", "--format=%an", "--", file)
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return 1
	}
	authors := map[string]bool{}
	for _, line := range strings.Split(string(out), "\n") {
		a := strings.TrimSpace(line)
		if a != "" {
			authors[a] = true
		}
	}
	return len(authors)
}
