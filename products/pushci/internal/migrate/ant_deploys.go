package migrate

import "strings"

// AntDeployTarget is the deploy-adjacent Ant target we auto-wire
// into the pipeline's `deploy:` block. Kept local (not
// config.DeployTarget) so internal/migrate stays free of the
// config dependency — the cmd layer does the translation.
type AntDeployTarget struct {
	Name    string   // e.g. "deploy", "deploy-prod"
	Run     string   // shell command, e.g. "ant deploy-prod"
	OnlyOn  []string // branches — inferred from suffix
	Trigger string   // always "push"
}

// antDeployPrefixes are the target-name prefixes that mark a real
// deploy (ship artifacts to a remote system) rather than a local
// artifact build step. Matches `deploy`, `deploy-*`, `publish`,
// `publish-*`, `upload`, `upload-*` — all compound-word variants
// users write in practice.
var antDeployPrefixes = []string{"deploy", "publish", "upload"}

// antBuildTargets are the artifact-producing targets already
// absorbed by the existing build stage (writeAntStages →
// pickAntBuildTarget). Kept here so we don't double-emit them as
// deploys when a user's build.xml contains e.g. `<target name="jar">`.
var antBuildTargets = map[string]bool{
	"dist": true, "jar": true, "war": true, "ear": true,
	"package": true, "build": true, "assemble": true,
	"release": true, // release targets are typically local packaging
}

// classifyAntDeploys walks declared targets and returns the slice
// of deploy-adjacent targets to wire into `deploy:`. Artifact-only
// targets (dist/jar/war/…) are ignored — they already become the
// build stage. Exported for testing.
func classifyAntDeploys(targets []string) []AntDeployTarget {
	var out []AntDeployTarget
	for _, t := range targets {
		if antBuildTargets[t] {
			continue
		}
		if !isAntDeployTarget(t) {
			continue
		}
		out = append(out, AntDeployTarget{
			Name:    t,
			Run:     "ant " + t,
			OnlyOn:  inferAntDeployBranches(t),
			Trigger: "push",
		})
	}
	return out
}

// isAntDeployTarget returns true when name starts with one of the
// deploy prefixes, either bare ("deploy") or suffixed by `-` /
// `_` / `.` ("deploy-prod", "publish_nexus"). Substring matches
// like "undeploy" are rejected — prefix-only.
func isAntDeployTarget(name string) bool {
	lower := strings.ToLower(name)
	for _, p := range antDeployPrefixes {
		if lower == p {
			return true
		}
		if strings.HasPrefix(lower, p+"-") || strings.HasPrefix(lower, p+"_") || strings.HasPrefix(lower, p+".") {
			return true
		}
	}
	return false
}

// inferAntDeployBranches picks branch gates from the target
// suffix. `deploy-dev` → develop, `deploy-stage` → staging/main,
// `deploy-prod` or bare `deploy` → main/master. Ordering matters:
// "prod" wins over "dev" (compound names like `deploy-prod-dev1`
// are still prod). Anything unrecognized defaults to main/master —
// users tighten by hand.
func inferAntDeployBranches(name string) []string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "prod"):
		return []string{"main", "master"}
	case strings.Contains(lower, "stage") || strings.Contains(lower, "staging"):
		return []string{"staging", "main"}
	case strings.Contains(lower, "qa"):
		return []string{"qa"}
	case strings.Contains(lower, "dev"):
		return []string{"develop", "dev"}
	default:
		return []string{"main", "master"}
	}
}
