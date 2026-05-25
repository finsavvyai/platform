package deploy

import "context"

const (
	TargetPulumi Target = "pulumi"
)

func pulumi(ctx context.Context, dir string, env map[string]string) *Result {
	stack := env["PULUMI_STACK"]

	// Select stack if specified
	if stack != "" {
		r := run(ctx, dir, env, "pulumi", "stack", "select", stack)
		r.Target = TargetPulumi
		if !r.Success {
			return r
		}
	}

	r := run(ctx, dir, env, "pulumi", "up", "--yes", "--non-interactive")
	r.Target = TargetPulumi
	return r
}
