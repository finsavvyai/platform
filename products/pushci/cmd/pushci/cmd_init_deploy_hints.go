package main

import (
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// mergeMigrationDeployHints folds migrate.DeployHint entries into
// the marker/TF-derived deploy target list. Hints fill the gap for
// platforms that have no canonical config file (ECS, EKS, generic
// `aws s3 sync` static deploys) — without this merge, vala-gate
// would silently fall through to "No clear deploy target" even
// after the GitLab migrator extracted `aws ecs update-service`.
//
// Existing platform entries are not duplicated. The hint's Run
// becomes the deploy command so the generated pushci.yml runs the
// same shell line the original CI did.
func mergeMigrationDeployHints(targets []detect.DeployTarget, hints []migrate.DeployHint) []detect.DeployTarget {
	if len(hints) == 0 {
		return targets
	}
	seen := map[string]bool{}
	for _, t := range targets {
		seen[t.Platform] = true
	}
	out := append([]detect.DeployTarget{}, targets...)
	for _, h := range hints {
		if seen[h.Platform] {
			continue
		}
		seen[h.Platform] = true
		out = append(out, detect.DeployTarget{
			Platform:   h.Platform,
			Command:    h.Run,
			ConfigFile: h.Source,
		})
	}
	return out
}
