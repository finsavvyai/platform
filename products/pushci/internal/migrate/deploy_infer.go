package migrate

import (
	"sort"
	"strings"
)

// DeployHint is a deploy target inferred from script content of an
// imported foreign CI pipeline. cmd_init translates these to
// config.DeployTarget when deploy-marker and TF resource scans
// both miss the actual platform — common for ECS, EKS, App Runner.
type DeployHint struct {
	Platform string
	Run      string
	Stage    string
	Source   string
}

type hintKey struct{ platform, stage string }

// InferDeployHintsFromScripts scans every command in stageJobs for
// known deploy-tool invocations and returns one DeployHint per
// (platform, stage) match, stable-sorted for deterministic output.
func InferDeployHintsFromScripts(stageJobs map[string][]string, source string) []DeployHint {
	seen := map[hintKey]DeployHint{}
	for stage, scripts := range stageJobs {
		for _, line := range scripts {
			matchPatterns(stage, line, source, seen)
		}
	}
	out := make([]DeployHint, 0, len(seen))
	for _, h := range seen {
		out = append(out, h)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Platform != out[j].Platform {
			return out[i].Platform < out[j].Platform
		}
		return out[i].Stage < out[j].Stage
	})
	return out
}

func matchPatterns(stage, line, source string, seen map[hintKey]DeployHint) {
	lower := strings.ToLower(line)
	for _, p := range deployScriptPatterns {
		if !allContain(lower, p.needles) {
			continue
		}
		k := hintKey{p.platform, stage}
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = DeployHint{
			Platform: p.platform,
			Run:      strings.TrimSpace(line),
			Stage:    stage,
			Source:   source + ": " + stage,
		}
	}
}

func allContain(haystack string, needles []string) bool {
	for _, n := range needles {
		if !strings.Contains(haystack, n) {
			return false
		}
	}
	return true
}
