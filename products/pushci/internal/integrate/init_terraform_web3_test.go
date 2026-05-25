package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitTerraform(t *testing.T) {
	dir := setupRepo(t, map[string]string{"main.tf": `resource "null_resource" "x" {}`})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Terraform {
		t.Fatalf("expected terraform, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "tf-plan", "terraform plan"},
		{"test", "tf-validate", "terraform validate"},
		{"lint", "tf-fmt", "terraform fmt -check"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitHelm(t *testing.T) {
	dir := setupRepo(t, map[string]string{"Chart.yaml": "apiVersion: v2\nname: myapp\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Helm {
		t.Fatalf("expected helm, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "helm-package", "helm package ."},
		{"test", "helm-lint", "helm lint ."},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitSolidity(t *testing.T) {
	dir := setupRepo(t, map[string]string{"foundry.toml": "[profile.default]\nsrc = \"src\"\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Solidity {
		t.Fatalf("expected solidity, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "forge-build", "forge build"},
		{"test", "forge-test", "forge test"},
		{"lint", "forge-fmt", "forge fmt --check"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitBun(t *testing.T) {
	dir := setupRepo(t, map[string]string{"bunfig.toml": "[install]\npeer = false\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Bun {
		t.Fatalf("expected bun, got %+v", projects)
	}
	s := hasStage(pipe, "test")
	if s == nil {
		t.Fatal("missing test stage")
	}
	if got := checkRun(s, "bun-test"); got != "bun test" {
		t.Errorf("bun-test run = %q, want %q", got, "bun test")
	}
}

func TestInitFortran(t *testing.T) {
	dir := setupRepo(t, map[string]string{"fpm.toml": "name = \"mylib\"\nversion = \"0.1.0\"\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Fortran {
		t.Fatalf("expected fortran, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "fpm-build", "fpm build"},
		{"test", "fpm-test", "fpm test"},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}
