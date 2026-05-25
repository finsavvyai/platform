package migrate

import (
	"strings"
	"testing"
)

// TestTerraformTeddkFixture is the real-world regression test: the
// anonymized teddk aws_pipeline/main.tf snapshot. It verifies end-to-end
// that we extract the two top-level resources, all five environment
// variables, the GitHub source URL, and the three codepipeline stages.
func TestTerraformTeddkFixture(t *testing.T) {
	result := ConvertTerraformPipeline("testdata/terraform-teddk")
	if len(result.Pipelines) != 2 {
		t.Fatalf("expected 2 pipelines (codebuild+codepipeline), got %d", len(result.Pipelines))
	}

	cb := findPipeline(result, "aws-codebuild")
	if cb == nil {
		t.Fatal("no codebuild pipeline found")
	}
	if !strings.Contains(cb.Source, "Shahar-Solomon-scq9102/teddk") {
		t.Errorf("expected teddk GitHub source URL, got %q", cb.Source)
	}
	for _, want := range []string{"AWS_DEFAULT_REGION", "AWS_ACCOUNT_ID", "IMAGE_TAG", "IMAGE_REPO_NAME", "PROD_ROLE_ARN"} {
		if _, ok := cb.EnvVars[want]; !ok {
			t.Errorf("env var %s missing from codebuild; got %v", want, cb.EnvVars)
		}
	}
	if cb.EnvVars["AWS_DEFAULT_REGION"] != "eu-north-1" {
		t.Errorf("literal env value mismatch: %q", cb.EnvVars["AWS_DEFAULT_REGION"])
	}
	assertSecretRef(t, result, "PROD_ROLE_ARN")
	assertWarning(t, result, "buildspec")

	cp := findPipeline(result, "aws-codepipeline")
	if cp == nil {
		t.Fatal("no codepipeline pipeline found")
	}
	if len(cp.Stages) != 3 {
		t.Fatalf("expected 3 codepipeline stages, got %d: %+v", len(cp.Stages), cp.Stages)
	}
	if cp.Stages[0].Name != "Source" || cp.Stages[0].Provider != "S3" {
		t.Errorf("stage[0] = %+v, want Source/S3", cp.Stages[0])
	}
	if cp.Stages[1].Config["ClusterName"] == "" {
		t.Errorf("stage[1] ClusterName missing from configuration map: %+v", cp.Stages[1].Config)
	}
	if cp.Stages[2].Provider != "Manual" {
		t.Errorf("stage[2] provider = %q, want Manual", cp.Stages[2].Provider)
	}
}

func TestTerraformGCPCloudBuild(t *testing.T) {
	result := ConvertTerraformPipeline("testdata/terraform-gcp")
	if len(result.Pipelines) != 1 {
		t.Fatalf("expected 1 pipeline, got %d", len(result.Pipelines))
	}
	p := result.Pipelines[0]
	if p.Platform != "gcp-cloudbuild" || p.BuildspecRef != "cloudbuild.yaml" {
		t.Errorf("bad pipeline: %+v", p)
	}
	if p.Source != "finsavvyai/pushci" {
		t.Errorf("source = %q, want finsavvyai/pushci", p.Source)
	}
	assertWarning(t, result, "cloudbuild.yaml")
}

func TestTerraformHarness(t *testing.T) {
	result := ConvertTerraformPipeline("testdata/terraform-harness")
	if len(result.Pipelines) != 1 || result.Pipelines[0].Platform != "harness" {
		t.Fatalf("expected harness pipeline, got %+v", result.Pipelines)
	}
	if result.Pipelines[0].Name != "Deploy Pipeline" {
		t.Errorf("name = %q", result.Pipelines[0].Name)
	}
	assertWarning(t, result, "Harness YAML")
}

func TestTerraformAzureDevOps(t *testing.T) {
	result := ConvertTerraformPipeline("testdata/terraform-azure")
	if len(result.Pipelines) != 1 {
		t.Fatalf("expected 1 pipeline, got %d", len(result.Pipelines))
	}
	p := result.Pipelines[0]
	if p.Platform != "azure-devops" || p.BuildspecRef != "azure-pipelines.yml" {
		t.Errorf("bad pipeline: %+v", p)
	}
}

func TestTerraformMissingDir(t *testing.T) {
	result := ConvertTerraformPipeline("testdata/does-not-exist")
	if len(result.Warnings) == 0 {
		t.Error("expected warning for missing dir")
	}
	if len(result.Pipelines) != 0 {
		t.Error("expected no pipelines for missing dir")
	}
}

func TestTerraformEmptyDir(t *testing.T) {
	result := ConvertTerraformPipeline("testdata")
	// testdata itself has no *.tf files at the top level
	if len(result.Warnings) == 0 {
		t.Error("expected 'no *.tf files' warning")
	}
}

func TestTerraformBraceMatching(t *testing.T) {
	// Strings containing { must not confuse the depth counter.
	src := `resource "x" "y" {
  name = "foo {with} braces"
  other = "}"
}`
	blocks := parseTerraformBlocks(src)
	if len(blocks) != 1 {
		t.Fatalf("expected 1 block, got %d", len(blocks))
	}
	if !strings.Contains(blocks[0].Body, `"foo {with} braces"`) {
		t.Errorf("body: %q", blocks[0].Body)
	}
}

func findPipeline(r *TerraformPipelineResult, platform string) *ExtractedPipeline {
	for i := range r.Pipelines {
		if r.Pipelines[i].Platform == platform {
			return &r.Pipelines[i]
		}
	}
	return nil
}

func assertSecretRef(t *testing.T, r *TerraformPipelineResult, name string) {
	t.Helper()
	for _, ref := range r.EnvVarsNeeded {
		if ref.Name == name && ref.IsSecret {
			return
		}
	}
	t.Errorf("expected %s to be flagged as secret; got %+v", name, r.EnvVarsNeeded)
}

func assertWarning(t *testing.T, r *TerraformPipelineResult, substr string) {
	t.Helper()
	for _, w := range r.Warnings {
		if strings.Contains(w, substr) {
			return
		}
	}
	t.Errorf("expected warning containing %q; got %v", substr, r.Warnings)
}
