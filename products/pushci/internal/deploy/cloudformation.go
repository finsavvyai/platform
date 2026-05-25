package deploy

import "context"

const (
	TargetCloudFormation Target = "cloudformation"
)

func cloudFormation(ctx context.Context, dir string, env map[string]string) *Result {
	stack := env["AWS_STACK_NAME"]
	template := env["AWS_TEMPLATE_FILE"]
	region := env["AWS_REGION"]
	if stack == "" {
		return &Result{
			Target: TargetCloudFormation,
			Output: "AWS_STACK_NAME required",
		}
	}
	if template == "" {
		template = "template.yaml"
	}

	args := []string{
		"cloudformation", "deploy",
		"--template-file", template,
		"--stack-name", stack,
		"--capabilities", "CAPABILITY_IAM", "CAPABILITY_NAMED_IAM",
	}

	if region != "" {
		args = append(args, "--region", region)
	}

	// Support parameters file
	paramsFile := env["AWS_PARAMS_FILE"]
	if paramsFile != "" {
		args = append(args, "--parameter-overrides", "file://"+paramsFile)
	}

	r := run(ctx, dir, env, "aws", args...)
	r.Target = TargetCloudFormation
	return r
}
