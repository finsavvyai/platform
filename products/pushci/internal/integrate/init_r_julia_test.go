package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitR(t *testing.T) {
	dir := setupRepo(t, map[string]string{".Rproj": "Version: 1.0\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.R {
		t.Fatalf("expected r, got %+v", projects)
	}
	for _, tc := range []struct{ stage, check, run string }{
		{"build", "r-build", "R CMD build ."},
		{"test", "r-test", `Rscript -e "testthat::test_dir('tests')"`},
	} {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
		} else if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitJulia(t *testing.T) {
	dir := setupRepo(t, map[string]string{"Project.toml": "name = \"MyPkg\"\nuuid = \"12345\"\n"})
	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Julia {
		t.Fatalf("expected julia, got %+v", projects)
	}
	s := hasStage(pipe, "test")
	if s == nil {
		t.Error("missing test stage")
	} else if got := checkRun(s, "julia-test"); got != `julia -e "using Pkg; Pkg.test()"` {
		t.Errorf("julia-test run = %q, want %q", got, `julia -e "using Pkg; Pkg.test()"`)
	}
}
