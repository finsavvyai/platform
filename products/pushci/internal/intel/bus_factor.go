package intel

import (
	"os/exec"
	"sort"
	"time"
)

// AuthorDistribution summarises per-file authorship within a time window.
// BusFactor = distinct authors: 0 = abandoned, 1 = risky, 2+ = healthy.
type AuthorDistribution struct {
	Path        string         `json:"path"`
	Authors     map[string]int `json:"authors"`
	Total       int            `json:"total"`
	BusFactor   int            `json:"bus_factor"`
	LastTouched time.Time      `json:"last_touched"`
}

// ComputeBusFactor runs `git log --name-only --since=<window>` and builds
// an author distribution per file. window=0 means "all history".
func ComputeBusFactor(repoRoot string, window time.Duration) (map[string]AuthorDistribution, error) {
	args := []string{"log", "--name-only", "--format=COMMIT%x00%an%x00%at"}
	if window > 0 {
		args = append(args, "--since="+time.Now().Add(-window).Format("2006-01-02"))
	}
	cmd := exec.Command("git", args...)
	cmd.Dir = repoRoot
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parseGitLog(string(out)), nil
}

// BusFactorOf returns the distinct author count for a file, or 0 if unknown.
func BusFactorOf(dist map[string]AuthorDistribution, path string) int {
	return dist[path].BusFactor
}

// Hotspots returns risky high-churn files (BF<=1 AND Total>5) sorted by
// change frequency DESC. topN<=0 means no limit.
func Hotspots(dist map[string]AuthorDistribution, topN int) []AuthorDistribution {
	var out []AuthorDistribution
	for _, d := range dist {
		if d.BusFactor <= 1 && d.Total > 5 {
			out = append(out, d)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Total != out[j].Total {
			return out[i].Total > out[j].Total
		}
		return out[i].Path < out[j].Path
	})
	if topN > 0 && len(out) > topN {
		out = out[:topN]
	}
	return out
}
