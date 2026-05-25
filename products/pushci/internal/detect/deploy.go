package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// DeployTarget represents a detected deployment platform.
type DeployTarget struct {
	Platform   string
	Command    string
	ConfigFile string
}

// deployMarker maps config files to deploy targets.
type deployMarker struct {
	file     string
	platform string
	command  string
}

// ScanDeployTargets detects deployment targets in a repo and
// returns the evidence-ranked list (strongest signal first).
// Weak or noise signals (bare `app.yaml`, lone `Dockerfile`) are
// filtered unless nothing stronger is present — the caller should
// check AmbiguousDeploy(RankDeployTargets(root)) to know whether
// to emit the "specify with --deploy=<target>" warning.
func ScanDeployTargets(root string) []DeployTarget {
	ranked := RankDeployTargets(root)
	kept := keepRanked(ranked)
	if len(kept) == 0 {
		kept = ranked // nothing strong; return whatever we found
	}
	out := make([]DeployTarget, 0, len(kept))
	for _, r := range kept {
		out = append(out, r.Target)
	}
	enrichCFPages(root, out)
	return out
}

// RankDeployTargets is the evidence-ranked view of the repo. Public
// so cmd_init (and tests) can inspect scores and decide whether to
// warn. Callers that only want the pruned list should use
// ScanDeployTargets.
func RankDeployTargets(root string) []RankedDeployTarget {
	return rankDeployTargets(root, rawMarkerHits(root))
}

// rawMarkerHits returns every filename-marker hit (unranked).
func rawMarkerHits(root string) []DeployTarget {
	var targets []DeployTarget
	seen := map[string]bool{}
	for _, m := range deployMarkers {
		path := filepath.Join(root, m.file)
		found := false
		if strings.HasSuffix(m.file, "/") {
			if info, err := os.Stat(path[:len(path)-1]); err == nil && info.IsDir() {
				found = true
			}
		} else if _, err := os.Stat(path); err == nil {
			found = true
		}
		if found && !seen[m.platform] {
			seen[m.platform] = true
			targets = append(targets, DeployTarget{
				Platform: m.platform, Command: m.command, ConfigFile: m.file,
			})
		}
	}
	return targets
}

// PrimaryDeployTarget returns the highest-evidence deploy target.
// Kept for API compatibility; internally it just takes the first
// item from the already-sorted ScanDeployTargets output.
func PrimaryDeployTarget(targets []DeployTarget) *DeployTarget {
	if len(targets) == 0 {
		return nil
	}
	return &targets[0]
}
