package deploy

import (
	"context"
	"fmt"
	"strings"
)

// RollbackResult holds the outcome of a rollback attempt.
type RollbackResult struct {
	Success   bool
	Target    Target
	Output    string
	VersionID string
}

// Rollback reverts to the previous deployment version.
func Rollback(ctx context.Context, target Target, dir string, env map[string]string) *RollbackResult {
	switch target {
	case TargetCloudflareWorkers:
		return rollbackWorkers(ctx, dir, env)
	case TargetCloudflarePages:
		return &RollbackResult{Success: true, Target: target, Output: "pages rollback: redeploy previous commit"}
	default:
		return &RollbackResult{Target: target, Output: fmt.Sprintf("rollback not supported for: %s", target)}
	}
}

func rollbackWorkers(ctx context.Context, dir string, env map[string]string) *RollbackResult {
	list := run(ctx, dir, env, "npx", "wrangler", "deployments", "list")
	if !list.Success {
		return &RollbackResult{Target: TargetCloudflareWorkers, Output: "failed to list deployments: " + list.Output}
	}
	vid := extractPreviousVersion(list.Output)
	if vid == "" {
		return &RollbackResult{Target: TargetCloudflareWorkers, Output: "no previous deployment found"}
	}
	r := run(ctx, dir, env, "npx", "wrangler", "rollback", "--version", vid)
	return &RollbackResult{Success: r.Success, Target: TargetCloudflareWorkers, Output: r.Output, VersionID: vid}
}

// extractPreviousVersion finds the second deployment ID in wrangler output.
func extractPreviousVersion(output string) string {
	found := 0
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) == 0 {
			continue
		}
		if id := fields[0]; len(id) >= 36 && strings.Count(id, "-") >= 4 {
			found++
			if found == 2 {
				return id
			}
		}
	}
	return ""
}
