package deploy

import (
	"context"
	"fmt"
)

// Stage represents a deployment stage (staging or production).
type Stage string

const (
	StageStaging    Stage = "staging"
	StageProduction Stage = "production"
)

// StageResult holds the outcome of a staged deployment.
type StageResult struct {
	Stage      Stage
	Deploy     *Result
	PreviewURL string
	Promoted   bool
}

// StagedDeploy runs a deployment to the staging environment.
func StagedDeploy(ctx context.Context, dir string, env map[string]string, target Target) (*StageResult, error) {
	r := deployStagingTarget(ctx, dir, env, target)
	if !r.Deploy.Success {
		return r, fmt.Errorf("staging deploy failed: %s", r.Deploy.Output)
	}
	return r, nil
}

// Promote deploys to production after a successful staging deploy.
func Promote(ctx context.Context, dir string, env map[string]string, target Target) (*StageResult, error) {
	r := &StageResult{Stage: StageProduction}
	r.Deploy = Deploy(ctx, target, dir, env)
	r.Promoted = r.Deploy.Success
	if !r.Deploy.Success {
		return r, fmt.Errorf("production deploy failed: %s", r.Deploy.Output)
	}
	return r, nil
}

func deployStagingTarget(ctx context.Context, dir string, env map[string]string, target Target) *StageResult {
	sEnv := copyEnv(env)
	r := &StageResult{Stage: StageStaging}
	switch target {
	case TargetCloudflarePages:
		sEnv["CF_BRANCH"] = "preview"
		r.Deploy = cfPages(ctx, dir, sEnv)
		r.PreviewURL = extractPreviewURL(r.Deploy.Output)
	case TargetCloudflareWorkers:
		r.Deploy = run(ctx, dir, sEnv, "npx", "wrangler", "deploy", "--env", "staging")
		r.Deploy.Target = TargetCloudflareWorkers
	default:
		r.Deploy = Deploy(ctx, target, dir, sEnv)
	}
	return r
}

func extractPreviewURL(output string) string {
	for _, line := range splitLines(output) {
		if len(line) > 8 && line[:8] == "https://" {
			return line
		}
	}
	return ""
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func copyEnv(env map[string]string) map[string]string {
	out := make(map[string]string, len(env))
	for k, v := range env {
		out[k] = v
	}
	return out
}
