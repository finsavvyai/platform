package deploy

import "context"

func awsECS(ctx context.Context, dir string, env map[string]string) *Result {
	cluster := env["AWS_ECS_CLUSTER"]
	service := env["AWS_ECS_SERVICE"]
	if cluster == "" || service == "" {
		return &Result{
			Target: TargetAWSECS,
			Output: "AWS_ECS_CLUSTER and AWS_ECS_SERVICE required",
		}
	}
	r := run(ctx, dir, env, "aws", "ecs", "update-service",
		"--cluster", cluster,
		"--service", service,
		"--force-new-deployment")
	r.Target = TargetAWSECS
	return r
}

func awsLambda(ctx context.Context, dir string, env map[string]string) *Result {
	fn := env["AWS_LAMBDA_FUNCTION"]
	zip := env["AWS_LAMBDA_ZIP"]
	if fn == "" {
		return &Result{Target: TargetAWSLambda, Output: "AWS_LAMBDA_FUNCTION required"}
	}
	if zip == "" {
		zip = "function.zip"
	}
	r := run(ctx, dir, env, "aws", "lambda", "update-function-code",
		"--function-name", fn,
		"--zip-file", "fileb://"+zip)
	r.Target = TargetAWSLambda
	return r
}

func awsS3(ctx context.Context, dir string, env map[string]string) *Result {
	bucket := env["AWS_S3_BUCKET"]
	srcDir := env["AWS_S3_SRC_DIR"]
	if bucket == "" {
		return &Result{Target: TargetAWSS3, Output: "AWS_S3_BUCKET required"}
	}
	if srcDir == "" {
		srcDir = "dist"
	}
	r := run(ctx, dir, env, "aws", "s3", "sync", srcDir, "s3://"+bucket,
		"--delete")
	r.Target = TargetAWSS3
	if r.Success {
		// Invalidate CloudFront if configured
		cfID := env["AWS_CLOUDFRONT_ID"]
		if cfID != "" {
			run(ctx, dir, env, "aws", "cloudfront", "create-invalidation",
				"--distribution-id", cfID, "--paths", "/*")
		}
	}
	return r
}
