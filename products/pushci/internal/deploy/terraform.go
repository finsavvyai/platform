package deploy

import (
	"context"
	"os"
	"strings"
)

const (
	TargetTerraform Target = "terraform"
)

func terraform(ctx context.Context, dir string, env map[string]string) *Result {
	passEnv := tfEnv(env)

	// terraform init
	r := run(ctx, dir, passEnv, "terraform", "init", "-input=false")
	r.Target = TargetTerraform
	if !r.Success {
		return r
	}

	// Select workspace if set
	if ws := env["TF_WORKSPACE"]; ws != "" {
		wr := run(ctx, dir, passEnv, "terraform", "workspace", "select", ws)
		if !wr.Success {
			// Try creating it
			run(ctx, dir, passEnv, "terraform", "workspace", "new", ws)
		}
	}

	// terraform plan
	r = run(ctx, dir, passEnv, "terraform", "plan", "-input=false")
	r.Target = TargetTerraform
	if !r.Success {
		return r
	}

	// terraform apply
	r = run(ctx, dir, passEnv, "terraform", "apply", "-auto-approve", "-input=false")
	r.Target = TargetTerraform
	return r
}

// tfEnv merges OS environment with overrides, passing through TF_VAR_*.
func tfEnv(env map[string]string) map[string]string {
	merged := make(map[string]string, len(env)+10)
	for _, e := range os.Environ() {
		if k, v, ok := strings.Cut(e, "="); ok {
			if strings.HasPrefix(k, "TF_VAR_") || k == "TF_WORKSPACE" {
				merged[k] = v
			}
		}
	}
	for k, v := range env {
		merged[k] = v
	}
	return merged
}
