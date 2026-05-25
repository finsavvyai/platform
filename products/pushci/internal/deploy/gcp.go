package deploy

import "context"

func gcpCloudRun(ctx context.Context, dir string, env map[string]string) *Result {
	service := env["GCP_SERVICE"]
	region := env["GCP_REGION"]
	image := env["GCP_IMAGE"]
	if service == "" || image == "" {
		return &Result{
			Target: TargetGCPCloudRun,
			Output: "GCP_SERVICE and GCP_IMAGE required",
		}
	}
	if region == "" {
		region = "us-central1"
	}
	r := run(ctx, dir, env, "gcloud", "run", "deploy", service,
		"--image", image,
		"--region", region,
		"--platform", "managed",
		"--allow-unauthenticated")
	r.Target = TargetGCPCloudRun
	return r
}

func gcpAppEngine(ctx context.Context, dir string, env map[string]string) *Result {
	r := run(ctx, dir, env, "gcloud", "app", "deploy",
		"--quiet", "--promote")
	r.Target = TargetGCPAppEngine
	return r
}
