package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestConsumeTerraformPipelines_TeddkFixture verifies init consumes
// the teddk-style aws_pipeline/*.tf and produces aws-ecs deploy
// target + secret env var hints, even in presence of a stray app.yaml.
func TestConsumeTerraformPipelines_TeddkFixture(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "aws_pipeline/main.tf", teddkFixture())
	writeFixture(t, dir, "app.yaml", "runtime: python39\n")

	hints := consumeTerraformPipelines(dir)
	if hints == nil {
		t.Fatal("expected hints, got nil")
	}
	if hints.Platform != "aws-ecs" {
		t.Errorf("platform = %q, want aws-ecs (TF must override app.yaml)", hints.Platform)
	}
	if len(hints.Deploys) != 1 {
		t.Fatalf("deploys = %d, want 1", len(hints.Deploys))
	}
	if !strings.Contains(hints.Deploys[0].Run, "aws-ecs") {
		t.Errorf("deploy.Run = %q, want aws-ecs reference", hints.Deploys[0].Run)
	}
	if !hasSecret(hints, "PROD_ROLE_ARN") {
		t.Error("expected PROD_ROLE_ARN to be flagged as secret")
	}
}

// TestConsumeTerraformPipelines_NoTF confirms the wiring is a no-op
// when no Terraform pipeline resources exist — init unchanged.
func TestConsumeTerraformPipelines_NoTF(t *testing.T) {
	dir := t.TempDir()
	writeFixture(t, dir, "package.json", "{\"name\":\"x\"}")
	if h := consumeTerraformPipelines(dir); h != nil {
		t.Errorf("expected nil hints, got %+v", h)
	}
}

// TestConsumeTerraformPipelines_CodeBuildOnly covers the TF +
// Dockerfile + buildspec case: a codebuild-only fixture resolves to
// aws-codebuild, not blank.
func TestConsumeTerraformPipelines_CodeBuildOnly(t *testing.T) {
	dir := t.TempDir()
	src := `resource "aws_codebuild_project" "b" {
  name = "svc-build"
  source { type = "GITHUB" location = "https://x.git" buildspec = "buildspec.yml" }
  environment {
    environment_variable { name = "AWS_ACCOUNT_ID" value = "1" }
  }
}`
	writeFixture(t, dir, "infra/main.tf", src)
	writeFixture(t, dir, "Dockerfile", "FROM alpine\n")
	writeFixture(t, dir, "buildspec.yml", "version: 0.2\n")
	hints := consumeTerraformPipelines(dir)
	if hints == nil || hints.Platform != "aws-codebuild" {
		t.Fatalf("want aws-codebuild, got %+v", hints)
	}
}

func writeFixture(t *testing.T, root, rel, body string) {
	t.Helper()
	p := filepath.Join(root, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func hasSecret(h *tfPipelineHints, name string) bool {
	for _, v := range h.EnvVars {
		if v.Name == name && v.IsSecret {
			return true
		}
	}
	return false
}

// teddkFixture reads the shared fixture from the migrate package so
// we don't fork a second copy that drifts from the regression test.
func teddkFixture() string {
	path := filepath.Join("..", "..", "internal", "migrate", "testdata", "terraform-teddk", "main.tf")
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	b, _ := io.ReadAll(f)
	return string(b)
}
