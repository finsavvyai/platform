package detect

import (
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func writeTf(t *testing.T, dir, rel, body string) {
	t.Helper()
	full := filepath.Join(dir, rel)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}
}

func markerSet(ps []CIProvider) []string {
	out := make([]string, 0, len(ps))
	for _, p := range ps {
		out = append(out, p.Marker)
	}
	sort.Strings(out)
	return out
}

func TestScanTerraformPipelines(t *testing.T) {
	cases := []struct {
		name    string
		files   map[string]string
		markers []string
	}{
		{
			name: "aws codebuild",
			files: map[string]string{
				"main.tf": `resource "aws_codebuild_project" "test" { name = "x" }`,
			},
			markers: []string{"ci:aws-codebuild-tf"},
		},
		{
			name: "aws codepipeline",
			files: map[string]string{
				"pipe.tf": `resource "aws_codepipeline" "p" {}`,
			},
			markers: []string{"ci:aws-codepipeline-tf"},
		},
		{
			name: "gcp cloudbuild",
			files: map[string]string{
				"infra/gcp.tf": `resource "google_cloudbuild_trigger" "t" {}`,
			},
			markers: []string{"ci:gcp-cloudbuild-tf"},
		},
		{
			name: "azure devops",
			files: map[string]string{
				"ado.tf": `resource "azuredevops_build_definition" "b" {}`,
			},
			markers: []string{"ci:azure-devops-tf"},
		},
		{
			name: "harness",
			files: map[string]string{
				"harness.tf": `resource "harness_platform_pipeline" "h" {}`,
			},
			markers: []string{"ci:harness-tf"},
		},
		{
			name: "mixed, dedupes across files",
			files: map[string]string{
				"a.tf": `resource "aws_codebuild_project" "one" {}` + "\n" +
					`resource "aws_codebuild_project" "two" {}`,
				"b.tf": `resource "aws_codepipeline" "p" {}`,
			},
			markers: []string{"ci:aws-codebuild-tf", "ci:aws-codepipeline-tf"},
		},
		{
			name:    "no pipelines",
			files:   map[string]string{"main.tf": `resource "aws_s3_bucket" "b" {}`},
			markers: nil,
		},
		{
			name: "commented out — ignored",
			files: map[string]string{
				"main.tf": "# resource \"aws_codebuild_project\" \"x\" {}\n" +
					"// resource \"aws_codepipeline\" \"p\" {}\n",
			},
			markers: nil,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for rel, body := range tc.files {
				writeTf(t, dir, rel, body)
			}
			got := ScanTerraformPipelines(dir)
			gm := markerSet(got)
			want := append([]string(nil), tc.markers...)
			sort.Strings(want)
			if len(gm) != len(want) {
				t.Fatalf("markers=%v want=%v (full=%+v)", gm, want, got)
			}
			for i := range gm {
				if gm[i] != want[i] {
					t.Errorf("marker[%d]=%q want %q", i, gm[i], want[i])
				}
			}
		})
	}
}

func TestScanTerraformPipelinesSkipsVendoredAndTerraformDir(t *testing.T) {
	dir := t.TempDir()
	writeTf(t, dir, ".terraform/modules/foo/main.tf",
		`resource "aws_codebuild_project" "vendored" {}`)
	writeTf(t, dir, "node_modules/pkg/infra.tf",
		`resource "aws_codepipeline" "vendored" {}`)
	if got := ScanTerraformPipelines(dir); len(got) != 0 {
		t.Fatalf("want no hits in vendored dirs, got %+v", got)
	}
}

func TestScanCIProvidersIncludesTerraformPipelines(t *testing.T) {
	dir := t.TempDir()
	writeTf(t, dir, "main.tf", `resource "aws_codebuild_project" "x" {}`)
	writeTf(t, dir, "pipe.tf", `resource "aws_codepipeline" "y" {}`)
	writeJenkinsfile(t, dir, "Jenkinsfile")
	writeBuildspec(t, dir, "buildspec.yml")
	got := ScanCIProviders(dir)
	gm := markerSet(got)
	want := []string{
		"ci:aws-codebuild",
		"ci:aws-codebuild-tf",
		"ci:aws-codepipeline-tf",
		"ci:jenkins",
	}
	sort.Strings(want)
	if len(gm) != len(want) {
		t.Fatalf("markers=%v want=%v", gm, want)
	}
	for i := range gm {
		if gm[i] != want[i] {
			t.Errorf("[%d]=%q want %q", i, gm[i], want[i])
		}
	}
}
