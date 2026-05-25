package detect

import "sort"

// RankedDeployTarget pairs a DeployTarget with its accumulated
// evidence score. Higher score means stronger signal that the
// user actually deploys to that platform. The ranker weighs
// TF resources (strongest), config-file contents (medium), and
// bare filename markers (weakest) so a stray `app.yaml` can't
// outrank a buildspec with `aws ecr` commands and
// `resource "aws_codebuild_project"` in TF. See deploy_rank_weights.go
// for the weight table and deploy_rank_evidence.go for signal collection.
type RankedDeployTarget struct {
	Target DeployTarget
	Score  int
}

// rankDeployTargets collects evidence from `root` and returns the
// candidate list sorted high-score first. Tie-break: TF-resource
// evidence > YAML config > filename-only, baked into the weights.
func rankDeployTargets(root string, raw []DeployTarget) []RankedDeployTarget {
	byPlat := collectEvidence(root)
	// Fold in filename weights so every detected platform has at
	// least its baseline (otherwise a platform with only a bare
	// marker file would score 0 and be dropped by keepRanked).
	for _, t := range raw {
		byPlat[t.Platform] += filenameWeight(t.Platform)
	}
	seen := map[string]bool{}
	out := []RankedDeployTarget{}
	for _, t := range raw {
		if seen[t.Platform] {
			continue
		}
		seen[t.Platform] = true
		out = append(out, RankedDeployTarget{Target: t, Score: byPlat[t.Platform]})
	}
	// Platforms with TF-only evidence (no filename marker) still need
	// to surface. Synthesize a DeployTarget from evidence defaults.
	for plat, score := range byPlat {
		if seen[plat] {
			continue
		}
		cmd, cfg := evidencePlatformDefaults(plat)
		out = append(out, RankedDeployTarget{
			Target: DeployTarget{Platform: plat, Command: cmd, ConfigFile: cfg},
			Score:  score,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].Score > out[j].Score
	})
	return out
}

// minKeepScore is the cutoff below which a ranked target is treated
// as noise rather than a real deploy signal. `app.yaml` bare (+1)
// falls below; Dockerfile at root (+2) falls below; any real deploy
// config like `fly.toml` (+4) or `vercel.json` (+4) passes.
const minKeepScore = 3

// keepRanked filters low-signal targets.
func keepRanked(ranked []RankedDeployTarget) []RankedDeployTarget {
	out := make([]RankedDeployTarget, 0, len(ranked))
	for _, r := range ranked {
		if r.Score >= minKeepScore {
			out = append(out, r)
		}
	}
	return out
}

// AmbiguousDeploy returns true when there is no clear winner. The
// caller emits the "specify with --deploy=<target>" warning.
// Ambiguous means: no ranked targets, or top score < minKeepScore.
func AmbiguousDeploy(ranked []RankedDeployTarget) bool {
	if len(ranked) == 0 {
		return true
	}
	return ranked[0].Score < minKeepScore
}
