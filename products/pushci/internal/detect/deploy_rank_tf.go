package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// addTerraformEvidence reads *.tf at the repo root and at common
// `infra/` / `terraform/` / `deploy/` subdirs and maps provider
// resources to their deploy targets. TF weights are the strongest
// single signal because provisioning code doesn't lie — if you
// have `resource "aws_ecs_service"` you deploy to ECS.
func addTerraformEvidence(root string, w map[string]int) {
	for _, dir := range []string{".", "infra", "terraform", "deploy"} {
		scanTfDir(filepath.Join(root, dir), w)
	}
}

// scanTfDir reads every .tf file under dir (non-recursive) and
// accumulates resource-pattern weights into w.
func scanTfDir(dir string, w map[string]int) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".tf") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		addTfResourceWeights(string(b), w)
	}
}

// tfResourceWeight is the table of TF resource fingerprints and
// their platform mapping. Substring match is safe — a line like
// `resource "aws_codebuild_project"` is specific enough to never
// collide with unrelated strings.
var tfResourceWeight = []struct {
	needle   string
	platform string
	weight   int
}{
	{`resource "aws_codebuild_project"`, "aws-codebuild", 5},
	{`resource "aws_codepipeline"`, "aws-codepipeline", 5},
	{`resource "aws_ecs_service"`, "aws-ecs", 6},
	{`resource "aws_lambda_function"`, "aws-lambda", 5},
	{`resource "aws_s3_bucket_website`, "aws-s3", 4},
	{`resource "google_cloud_run_`, "gcp-cloud-run", 5},
	{`resource "google_app_engine_`, "gcp-app-engine", 5},
}

func addTfResourceWeights(src string, w map[string]int) {
	for _, r := range tfResourceWeight {
		if strings.Contains(src, r.needle) {
			w[r.platform] += r.weight
		}
	}
}
