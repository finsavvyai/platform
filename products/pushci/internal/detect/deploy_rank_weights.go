package detect

// filenameWeight is the baseline weight for a platform whose only
// signal is a filename marker. Richer evidence (TF resources, YAML
// content) stacks on top in collectEvidence. See the weight table
// in the task spec — these numbers are the "filename present"
// baseline, additional weights live in deploy_rank_evidence.go.
func filenameWeight(platform string) int {
	switch platform {
	case "gcp-app-engine":
		return 1
	case "docker", "docker-compose":
		return 2
	case "heroku":
		return 3
	case "fly", "railway", "netlify", "vercel", "aws-cdk":
		return 4
	case "aws-codebuild", "aws-codepipeline", "aws-lambda",
		"aws-sam", "aws-s3", "aws-ecs", "cloudflare-workers",
		"cloudflare-pages", "gcp-cloud-run":
		return 5
	}
	return 1
}

// evidencePlatformDefaults returns a default command + config-file
// label for platforms surfaced solely via TF evidence (no filename
// marker in deployMarkers). Picked so the generated pushci.yml
// stage still runs something sane — the user can override.
func evidencePlatformDefaults(platform string) (cmd, cfg string) {
	switch platform {
	case "gcp-cloud-run":
		return "gcloud run deploy", "*.tf (google_cloud_run)"
	case "aws-codebuild":
		return "aws codebuild start-build", "*.tf (aws_codebuild_project)"
	case "aws-codepipeline":
		return "aws codepipeline start-pipeline-execution", "*.tf (aws_codepipeline)"
	case "aws-ecs":
		return "aws ecs update-service --force-new-deployment", "*.tf (aws_ecs_service)"
	case "aws-lambda":
		return "npx serverless deploy", "*.tf (aws_lambda_function)"
	case "aws-s3":
		return "aws s3 sync ./dist s3://bucket", "*.tf (aws_s3_bucket)"
	}
	return "", "(evidence-only)"
}
