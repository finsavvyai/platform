package detect

import (
	"os"
	"path/filepath"
	"testing"
)

type fileSeed struct {
	path    string
	content string
}

func seedRepo(t *testing.T, files []fileSeed) string {
	t.Helper()
	dir := t.TempDir()
	for _, f := range files {
		full := filepath.Join(dir, f.path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(f.content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// TestDeployRank_Teddk reproduces the dogfood bug: a stray
// `app.yaml` at the repo root used to beat overwhelming AWS
// evidence (buildspec.yml with `aws ecr`, TF provisioning
// CodePipeline + CodeBuild, Dockerfile) because the old picker
// had no evidence scoring. With weight-based ranking, aws-ecs (+6
// from `aws_ecs_service`) wins over gcp-app-engine (+1).
func TestDeployRank_Teddk(t *testing.T) {
	dir := seedRepo(t, []fileSeed{
		{"app.yaml", "some: bare yaml\n"},
		{"Dockerfile", "FROM alpine\n"},
		{"buildspec.yml", "version: 0.2\nphases:\n  build:\n    commands:\n      - aws ecr get-login-password\n"},
		{"infra/main.tf", `resource "aws_codebuild_project" "x" {}
resource "aws_codepipeline" "y" {}
resource "aws_ecs_service" "z" {}`},
	})
	ranked := RankDeployTargets(dir)
	if len(ranked) == 0 {
		t.Fatalf("expected ranked targets, got empty")
	}
	top := ranked[0].Target.Platform
	if top != "aws-ecs" && top != "aws-codebuild" && top != "aws-codepipeline" {
		t.Fatalf("teddk fixture: top=%s, want AWS (ecs/codebuild/codepipeline). ranked=%+v", top, ranked)
	}
	// gcp-app-engine must not win — bare app.yaml is +1 at most.
	for _, r := range ranked {
		if r.Target.Platform == "gcp-app-engine" && r.Score >= ranked[0].Score {
			t.Fatalf("gcp-app-engine scored %d, tied/beat top %d", r.Score, ranked[0].Score)
		}
	}
}

// TestDeployRank_ClearVercel: vercel.json with build config and a
// next.config.js → vercel wins cleanly.
func TestDeployRank_ClearVercel(t *testing.T) {
	dir := seedRepo(t, []fileSeed{
		{"vercel.json", `{"build": {"env": {}}}`},
		{"next.config.js", "module.exports = {}\n"},
		{"package.json", `{"name":"x"}`},
	})
	ranked := RankDeployTargets(dir)
	if len(ranked) == 0 || ranked[0].Target.Platform != "vercel" {
		t.Fatalf("expected vercel top, got %+v", ranked)
	}
	if AmbiguousDeploy(ranked) {
		t.Fatalf("clear vercel should not be ambiguous")
	}
}

// TestDeployRank_AmbiguousAppYaml: a bare app.yaml with no other
// signals is too weak (score 1) — the caller should warn.
func TestDeployRank_AmbiguousAppYaml(t *testing.T) {
	dir := seedRepo(t, []fileSeed{
		{"app.yaml", "some: thing\n"},
	})
	ranked := RankDeployTargets(dir)
	if !AmbiguousDeploy(ranked) {
		t.Fatalf("bare app.yaml should be ambiguous, ranked=%+v", ranked)
	}
	// ScanDeployTargets still returns it (better than empty) but
	// the warning should fire.
	if got := ScanDeployTargets(dir); len(got) == 0 {
		t.Fatalf("ScanDeployTargets should still surface the weak signal")
	}
}

// TestDeployRank_EmptyRepo: no signals → ambiguous, empty.
func TestDeployRank_EmptyRepo(t *testing.T) {
	dir := seedRepo(t, nil)
	ranked := RankDeployTargets(dir)
	if !AmbiguousDeploy(ranked) {
		t.Fatalf("empty repo must be ambiguous")
	}
	if got := ScanDeployTargets(dir); len(got) != 0 {
		t.Fatalf("empty repo: expected no targets, got %+v", got)
	}
}

// TestDeployRank_TfBeatsYaml: TF with `google_cloud_run_service`
// beats a bare app.yaml (tie-break rule: TF > YAML).
func TestDeployRank_TfBeatsYaml(t *testing.T) {
	dir := seedRepo(t, []fileSeed{
		{"app.yaml", "runtime: go120\n"}, // bare (no env:/service:) — stays at +1
		{"main.tf", `resource "google_cloud_run_service" "svc" {}`},
	})
	ranked := RankDeployTargets(dir)
	if len(ranked) == 0 || ranked[0].Target.Platform != "gcp-cloud-run" {
		t.Fatalf("expected gcp-cloud-run top, got %+v", ranked)
	}
}
